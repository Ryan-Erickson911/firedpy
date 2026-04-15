# Load CSV and GeoJSON, join on country name, and write updated GeoJSON
import json
import os
import numpy as np
import pandas as pd
import geopandas as gpd

# Paths
csv_path = "assets/map/parameters_for_individual_countries.csv"
readme_path = "assets/map/readme_links.csv"
geojson_path = "assets/map/base_countries.geojson"
output_path =  "assets/map/processed_countries_with_params.geojson"

# Data
new_params = pd.read_csv(csv_path)
readme = pd.read_csv(readme_path)

# Normalize Country Names and Rows
readme.columns = readme.columns.str.strip()
readme["Country"] = (readme["Country"].astype(str).str.strip().str.lower().str.replace(" ", "_", regex=False).str.strip("_"))

new_params["key"] = new_params["country_name"].str.lower().str.replace(" ", "_")
readme["key"] = readme["Country"].str.lower()

# Left join: keep all new_params rows, attach readme columns when matched
final_data = new_params.merge(readme, on="key", how="left")
join_data = final_data[[ 'Proper Case', 'continent', 'MapJoin', 'V2022 (variable space-time parameters)', 'V2024S1T5 (1 pixel 5 days for everything)', 'f_file_name']].copy()

geo = gpd.read_file(geojson_path)

geo["key"] = geo["NAME"].str.strip().str.lower()
join_data["key"] = join_data["Proper Case"].str.strip().str.lower()

# Merge
merged = geo.merge(
    join_data[[
        "key",
        "continent",
        "MapJoin",
        "V2022 (variable space-time parameters)",
        "V2024S1T5 (1 pixel 5 days for everything)",
        "f_file_name"
    ]],
    on="key",
    how="left"
)

merged = merged.drop(columns=["key"])
merged.columns = ['fid', 'FIPS', 'ISO2', 'ISO3', 'UN', 'NAME', 'AREA', 'POP2005', 'REGION', 'SUBREGION', 'LON', 'LAT', 'geometry', 'continent', 'MapJoin', 'V2022', 'V2024S1T5', 'f_file_name']
merged.to_file(output_path, driver='GeoJSON')