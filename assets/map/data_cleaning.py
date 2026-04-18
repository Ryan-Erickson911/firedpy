# Load CSV and GeoJSON, join on country name, and write updated GeoJSON
import json
import os
import numpy as np
import pandas as pd
import geopandas as gpd

#functions
def collect_datasets(row):
    items = []

    for col in row.index:
        if (
            col.endswith("V2022") or
            col.endswith("V2024S1T5") or
            col.endswith("f_file_name")
        ):
            val = row[col]
            if pd.notna(val) and val != "":
                items.append(f"{col}: {val}")

    return items

# Paths
csv_path = "assets/map/readme_links_joined_to_newestparams.csv" # params csv joined to readme table
geojson_path = "assets/map/base_countries.geojson" # world.gpkg file
fin_table = "assets/map/map_table.csv" #display table
output_path =  "assets/map/countries_with_params.geojson" #countries with a singular entry

# Data
new_params = pd.read_csv(csv_path) # Adam's countries csv merged with readme -> Newest data
geo = gpd.read_file(geojson_path) # world.gpkg -> Main map

region_dict = {0:"Antarctica", 2:"Africa", 9: "Oceania", 19: "Americas", 142:"Asia", 150:"Europe"}
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

map_table = new_params[["country_name", "REGION","SUBREGION","UN","V2022","V2024S1T5","f_file_name"]].copy()

# Fixing 0 for UN code
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
    geo.loc[geo["UN"] == un_code, ["REGION", "SUBREGION"]] = [
        region,
        subregion,
    ]

map_table["_n"] = map_table.groupby(["UN"]).cumcount()
multi_states = np.unique(map_table.loc[map_table["_n"] > 0]["UN"])
multi_link_poly = map_table.loc[map_table["UN"].isin(multi_states)]

geo_single = geo.loc[~geo["UN"].isin(multi_states)]
geo_multi = geo.loc[geo["UN"].isin(multi_states)]

geo_single_data = geo_single.merge(map_table, on=["UN","REGION","SUBREGION"], how="left").drop('_n',axis=1)
geo_single_data["datasets"]  = geo_single_data.apply(collect_datasets, axis=1)
geo_single_merge = geo_single_data[['fid', 'FIPS', 'ISO2', 'ISO3', 'UN', 'NAME', 'AREA', 'POP2005','REGION', 'SUBREGION', 'LON', 'LAT', 'geometry', 'datasets']].copy()

multi_link_poly = multi_link_poly.drop("_n",axis=1)

wide = multi_link_poly.pivot_table(
    index=["UN","REGION","SUBREGION"],
    columns="country_name",
    aggfunc="first"
)

wide.columns = [f"{i}-{col}" for col, i in wide.columns]

wide = wide.reset_index()

geo_multi_data = geo_multi.merge(wide,on=["UN","REGION","SUBREGION"],how="left")

geo_multi_data["datasets"]  = geo_multi_data.apply(collect_datasets, axis=1)

geo_multi_merge = geo_multi_data[['fid', 'FIPS', 'ISO2', 'ISO3', 'UN', 'NAME', 'AREA', 'POP2005','REGION', 'SUBREGION', 'LON', 'LAT', 'geometry', 'datasets']].copy()

geo_all = pd.concat([geo_single_merge, geo_multi_merge], ignore_index=True)

geo_all["REGION"] = geo_all["REGION"].map(region_dict)
geo_all["SUBREGION"] = geo_all["SUBREGION"].map(sub_region_dict)

geo_all[["NAME","REGION","SUBREGION","datasets"]].to_csv(fin_table)
geo_all.to_file(output_path, driver='GeoJSON')