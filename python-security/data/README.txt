Put the downloaded IoT cybersecurity dataset CSV here as:

    iot_dataset.csv

Recommended datasets (see dataset_loader.py docstring for full detail):
  - CICIoT2023: https://www.unb.ca/cic/datasets/iotdataset-2023.html
  - ToN_IoT:    https://research.unsw.edu.au/projects/toniot-datasets

After downloading, run this from python-security/ to confirm your
CSV's actual column names before the loader tries to clean it:

    python -c "import dataset_loader; dataset_loader.inspect_columns()"

If the printed column names differ from the ones assumed in
COLUMN_MAP inside dataset_loader.py, edit COLUMN_MAP to match.
