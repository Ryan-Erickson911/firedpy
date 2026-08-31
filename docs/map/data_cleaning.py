# python .\assets\map\data_cleaning.py
# This script is designed to assign UN numbers using pycountry.
import json
import os
import numpy as np
import pandas as pd
import geopandas as gpd
import re
import pycountry

# normalize name for all sources
def normalize(name):
    name = name.lower().strip()
    name = name.replace("_", " ")
    name = re.sub(r"\s+", " ", name)
    return name

# codes that have a UN assigned but are missed due to character mismatch
def assign_UN(df,col,keep=None, name=None):
    '''Function to assign uncodes to different csvs in data. 
    
    df = a dataframe needing UN codes from pycountry.
    col = the column with a viable country name, it will be normalized.
    keep = Optional, columns to keep after assigning the UN.
    name = Summarized title of the file you want UN codes added to
    
    returns any missed countries for manual handling
    '''
    manual_aliases = {"aland": 248,
                      "ashmore and cartier islands":36,
                      "bolivia": 68,
                      "brunei":96,
                      "curacao":530,
                      "democratic republic of the congo":180,
                      "dutch carribean colonies":530,
                      "east timor":626,
                      "falkland islands":238,
                      "french southern and antarctic lands":250,
                      "guadeloupe":312,
                      "martinique":474, #typo 
                      "guinea bissau":624,
                      "indian ocean territories":36,
                      "iran": 364,
                      "ivory coast":384,
                      "kosovo":689,
                      "laos":418,
                      "macedonia": 807,
                      "moldova": 498,
                      "new south wales + capital territory":36,
                      "north korea": 408,
                      "northern cyprus":792,
                      "northern territory":36,
                      "palestine": 275,
                      "pitcairn islands":612,
                      "queensland":36,
                      "russia": 643,
                      "saint barthelemy":652,
                      "saint helena":654,
                      "sint maarten":663,
                      "saint martin":663,
                      "somaliland":706,
                      "south australia":36,
                      "south georgia and the islands":239,
                      "south korea": 410,
                      "syria": 760,
                      "taiwan":158,
                      "tanzania": 834,
                      "tasmania":36,
                      "the bahamas":44,
                      "turkey":792,
                      "united states virgin islands":850,
                      "usa virgin islands":850,
                      "usa alaska":840,
                      "usa hawaii":840,
                      "usa lower48":840,
                      "vatican": 336,
                      "venezuela": 862,
                      "victoria":36,
                      "vietnam": 704,
                      "western australia":36
                      }
    codes = []
    missed = []
    if name:
        print(f"Adding UN codes to {name}")
    for name in df[col]:
        n = normalize(name)
        if n in country_lookup:
            codes.append(int(country_lookup[n]))
        elif n in manual_aliases:  
            codes.append(int(manual_aliases[n]))
        else:
            missed.append(n)
            codes.append(9999)
    df["UN"] = codes 
    miss = len(missed)
    if keep:
        df = df[keep]
    print(f'  Missed {miss} counties:')
    for i in missed:
        print(f"    {i.title()}")
    return

# Data
# output paths
world_boundaries_output_path = "docs/map/countries_with_params.geojson" 
final_output_path = "docs/map/un_readme_params.csv"

# Original files - fixed shapes in wourld boundaries (Sudan/South Sudan/Kosovo), adam's -sp -tp sheet, ryan's readme.csv.
world_boundaries = "docs/map/processed_world_boundaries_RE.geojson" # original => world.gpkg file
csv_path = "firedpy/data/parameters_for_individual_countries.csv" # params csv 
readme = "docs/map/readme_links.csv" # readme links

# read data
new_params = pd.read_csv(csv_path) 
readme_paths = pd.read_csv(readme)
world_geo = gpd.read_file(world_boundaries) 

# Dictionaries
# pycountry UN for similarity across datasets
common_names = {}
for c in pycountry.countries:
    if hasattr(c, 'common_name'):
        common_names[normalize(c.common_name)] = c.numeric
    elif hasattr(c, 'name'):
        common_names[normalize(c.name)] = c.numeric
    else:
        common_names[normalize(c.official_name)] = c.numeric
country_lookup = {}
for c in pycountry.countries:
    country_lookup[normalize(c.name)] = c.numeric
    if hasattr(c,"official_name"):
        country_lookup[normalize(c.official_name)] = c.numeric

country_lookup = {k: int(v) for k, v in country_lookup.items()}
mapping_c = {int(v): k for k, v in common_names.items()}
mapping_r = dict(zip(world_geo["UN"], world_geo["REGION"]))
mapping_sr = dict(zip(world_geo["UN"], world_geo["SUBREGION"]))

# For long name regions
region_dict = {
    0:"Antarctica", 
    2:"Africa", 
    9: "Oceania", 
    19: "Americas", 
    142:"Asia", 
    150:"Europe"}
### Subregions
subregion_dict = {
    0:"Territory",   
    5:"South America",
    11:"West Africa",  
    13:"Central America",  
    14:"East Africa", 
    15:"North Africa",  
    17:"Middle Africa",  
    18:"South Africa",  
    21:"North America",  
    29:"Carribean",  
    30:"East Asia",  
    34:"South Asia",  
    35:"South-East Asia", 
    39:"South Europe",  
    53:"Australia",
    56: "New Zealand",
    54:"Melanesia",  
    57:"Micronesia", 
    61:"Polynesia", 
    143:"Central Asia", 
    145:"West Asia", 
    151:"East Europe", 
    154:"North Europe", 
    155:"West Europe"}

# notitced some 0's for REGION and SUBREGION in gpkg
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

# starting longname region and subregion by UN
for un_code, (region, subregion) in fix_map.items():
    world_geo.loc[world_geo["UN"] == un_code, ["REGION", "SUBREGION"]] = [
        region,
        subregion,
    ]

# unwanted columns
world_geo=world_geo.drop(["AREA","POP2005","layer","path","area_2","perimeter"],axis=1)

# assign UN to datasets
assign_UN(new_params,'country_name', name="Spatial-temporal params")
assign_UN(readme_paths,'Country', name="Readme links")

# Join params to readme links (some added due to nameing)
readme_paths["Country"] = readme_paths["Country"].str.lower()
new_params["country_name"] = new_params["country_name"].map(normalize)
rdm_and_params = new_params.merge(readme_paths,left_on=["UN","country_name"], right_on=["UN","Country"], how="outer") # if inspecting -> ,indicator=True)
#if indicator=True -> rdm_and_params.loc[rdm_and_params._merge!="both"]
# if inspecting -> rdm_and_params.loc[rdm_and_params.duplicated(subset="UN",keep=False)]

# Assign overarching name, region, and subregion
rdm_and_params["country_name"] = rdm_and_params["country_name"].fillna(rdm_and_params["Country"])
rdm_and_params["Country"] = rdm_and_params["UN"]
rdm_and_params["Country"] = rdm_and_params["Country"].replace(mapping_c)
rdm_and_params["REGION"] = rdm_and_params["UN"]
rdm_and_params["REGION"] = rdm_and_params["REGION"].replace(mapping_r)
rdm_and_params["REGION"] = rdm_and_params["REGION"].replace(region_dict)
rdm_and_params["SUBREGION"] = rdm_and_params["UN"]
rdm_and_params["SUBREGION"] = rdm_and_params["SUBREGION"].replace(mapping_sr)
rdm_and_params["SUBREGION"] = rdm_and_params["SUBREGION"].replace(subregion_dict)

final_links_params = rdm_and_params.loc[rdm_and_params["UN"] != 9999,["UN","country_name","Country","REGION","SUBREGION","spatial","temporal","V2022","V2024S1T5"]]
final_links_params["country_name"] = final_links_params["country_name"].str.title()
final_links_params["Country"] = final_links_params["Country"].str.title()
final_links_params["Country"] = final_links_params["Country"].str.split(", ", n=1).str[0]
# check readme, replace double quotes, rearrange names, and replace "Of" and "And" to "of" and "and" 
# if Country contains ", " move the word before it to the end of the string
# if the country does not start with The, change it to lower("the")

world_geo.to_file(world_boundaries_output_path, driver='GeoJSON')
final_links_params.to_csv(final_output_path)

print(f"Saved files to \n  {world_boundaries_output_path}\n  {final_output_path}")