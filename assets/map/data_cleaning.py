# Load CSV and GeoJSON, join on country name, and write updated GeoJSON
import json
import os
import numpy as np
import pandas as pd
import geopandas as gpd

# Create the finalized CSV with the user's rules applied
import pandas as pd
import pycountry
import re

# funfuns
def normalize(name):
    name = name.lower().strip()
    name = name.replace("_", " ")
    name = re.sub(r"\s+", " ", name)
    return name

def set_code(df, name, code):
    df.loc[df["country_name"] == name, "UN"] = code

#functions
def collect_datasets(row):
    data = {}
    for col in row.index:
        if (
            col.endswith("V2022") or
            col.endswith("V2024S1T5") or
            col.endswith("spatial") or
            col.endswith("temporal")
        ):
            val = row[col]
            if pd.notna(val) and val != "":
                data[col] = val
    return json.dumps(data)

# Dictionaries
# Build lookup dict from pycountry
country_lookup = {}
for c in pycountry.countries:
    country_lookup[normalize(c.name)] = c.numeric
    if hasattr(c, 'official_name'):
        country_lookup[normalize(c.official_name)] = c.numeric
country_lookup = {k: int(v) for k, v in country_lookup.items()}

# Manual discrepencies - gathered after initial country lookup
manual_aliases = {
    "aland": 248,
    "ashmore_and_cartier_islands":36,
    "bolivia": 68,
    "brunei":96,
    "curacao":530,
    "democratic_republic_of_the_congo":180,
    "dutch_carribean_colonies":530,
    "east_timor":626,
    "falkland_islands":238,
    "french_southern_and_antarctic_lands":250,
    "guadeloupe":312,
    "martinique":474, #typo 
    "guinea_bissau":624,
    "indian_ocean_territories":36,
    "iran": 364,
    "ivory_coast":384,
    "kosovo":688,
    "laos":418,
    "macedonia": 807,
    "moldova": 498,
    "new_south_wales_+_capital_territory":36,
    "north_korea": 408,
    "northern_cyprus":792,
    "northern_territory":36,
    "palestine": 275,
    "pitcairn_islands":612,
    "queensland":36,
    "russia": 643,
    "saint_barthelemy":652,
    "saint_helena":654,
    "saint_martin":663,
    "sint_maarten":663,
    "somaliland":706,
    "south_australia":36,
    "south_georgia_and_the_islands":239,
    "south_korea": 410,
    "syria": 760,
    "taiwan":158,
    "tanzania": 834,
    "tasmania":36,
    "the_bahamas":44,
    "turkey":792,
    "united_states_virgin_islands":850,
    "usa_alaska":840,
    "usa_hawaii":840,
    "usa_lower48":840,
    "vatican": 336,
    "venezuela": 862,
    "victoria":36,
    "vietnam": 704,
    "western_australia":36}

region_dict = {
    0:"Antarctica", 
    2:"Africa", 
    9: "Oceania", 
    19: "Americas", 
    142:"Asia", 
    150:"Europe"}

sub_region_dict = {
    0:"Territory",   
    5:"South America",
    11:"Western Africa",  
    13:"Central America",  
    14:"Eastern Africa", 
    15:"Northern Africa",  
    17:"Middle Africa",  
    18:"Southern Africa",  
    21:"Northern America",  
    29:"Carribean",  
    30:"Eastern Asia",  
    34:"Southern Asia",  
    35:"South-Eastern Asia", 
    39:"Southern Europe",  
    53:"Australia and New Zealand",
    54:"Melanesia",  
    57:"Micronesia", 
    61:"Polynesia", 
    143:"Central Asia", 
    145:"Western Asia", 
    151:"Eastern Europe", 
    154:"Northern Europe", 
    155:"Western Europe"}

# Load original file
csv_path = "firedpy/data/parameters_for_individual_countries.csv" # params csv 
out_path = "firedpy/data/parameters_for_individual_countries_RE.csv"
my_wb = "assets/map/world_boundaries_RE.geojson" # world.gpkg file
geojson_path = "firedpy/data/boundaries/world.gpkg" # world.gpkg file
readme = "assets/map/readme_links.csv" # readme links
output_path =  "assets/map/countries_with_params.geojson" #countries with a singular entry
new_params = pd.read_csv(csv_path) # Adam's countries csv merged with readme -> Newest data
readme_paths = pd.read_csv(readme)
world_geo = gpd.read_file(geojson_path) # world.gpkg -> Main map?
test_world_geo = gpd.read_file(my_wb) 

readme_paths["country_name"] = readme_paths["Country"].str.lower().str.replace(" ", "_")

params_and_links = new_params.merge(readme_paths, on="country_name", how ="outer",indicator=True)
params_and_links.loc[params_and_links["_merge"]!="both"]

# normalize names and codes
codes = []
for name in params_and_links["country_name"]:
    n = normalize(name)
    if n in country_lookup:
        codes.append(int(country_lookup[n]))
    else:
        codes.append(9999)
params_and_links["UN"] = codes 
for k, v in manual_aliases.items():
    set_code(params_and_links,k, v)
params_and_links.loc[params_and_links["UN"]==9999,]

# used to find rows that need manual fixing 
# fixing 0's for REGION and SUBREGION with UN code in gpkg
fix_map = {
    166: (9, 53),    # Cocos (Keeling) Islands
    10:  (10, 0),    # Antarctica
    74:  (2, 18),    # Bouvet Island
    260: (2, 14),    # French Southern & Antarctic Lands
    334: (10, 0),    # Heard & McDonald Islands
    86:  (2, 14),    # British Indian Ocean Territory
    162: (9, 53),    # Christmas Island
    581: (19, 21),   # US Minor Outlying Islands
    239: (19, 5),    # South Georgia & South Sandwich Islands
    158: (142, 30),  # Taiwan
}

for un_code, (region, subregion) in fix_map.items():
    test_world_geo.loc[test_world_geo["UN"] == un_code, ["REGION", "SUBREGION"]] = [
        region,
        subregion,
    ]

map_table = params_and_links[['UN', 'country_name', 'Country', 'spatial', 'temporal', 'V2022', 'V2024S1T5']].copy()
test_world_geo[~test_world_geo["UN"].isin(map_table['UN'])]
map_table[~map_table["UN"].isin(test_world_geo['UN'])]

map_table["_n"] = map_table.groupby(["UN"]).cumcount()
multi_states = np.unique(map_table.loc[map_table["_n"] > 0]["UN"])
multi_link_poly = map_table.loc[map_table["UN"].isin(multi_states)]

geo_single = test_world_geo.loc[~test_world_geo["UN"].isin(multi_states)]
geo_multi = test_world_geo.loc[test_world_geo["UN"].isin(multi_states)]

geo_single_data = geo_single.merge(map_table, on=["UN"], how="left").drop('_n',axis=1)
geo_single_data["DATA"]  = geo_single_data.apply(collect_datasets, axis=1)
geo_single_merge = geo_single_data[['UN', 'NAME','REGION', 'SUBREGION', 'LON', 'LAT', 'geometry', 'DATA']].copy()

multi_link_poly = multi_link_poly.drop("_n",axis=1)

wide = multi_link_poly.pivot_table(
    index=["UN"],
    columns="country_name",
    aggfunc="first"
)

wide.columns = [f"{i}-{col}" for col, i in wide.columns]

wide = wide.reset_index()

geo_multi_data = geo_multi.merge(wide,on=["UN"],how="left")

geo_multi_data["DATA"]  = geo_multi_data.apply(collect_datasets, axis=1)

geo_multi_merge = geo_multi_data[['UN', 'NAME','REGION', 'SUBREGION', 'LON', 'LAT', 'geometry', 'DATA']].copy()

geo_all = pd.concat([geo_single_merge, geo_multi_merge], ignore_index=True)

geo_all["REGION"] = geo_all["REGION"].map(region_dict)
geo_all["SUBREGION"] = geo_all["SUBREGION"].map(sub_region_dict)
geo_all.to_file(output_path, driver='GeoJSON')