# Navora One-Click Git + Render Notes

This package includes `render.yaml` for Render Blueprint deployment of:
- `navora-web`: Node/Express backend that also serves the complete frontend.
- `navora-ai`: FastAPI AI service.

Secrets are never embedded in the BAT or repository. The initial Render Blueprint flow requests `MONGODB_URI`; add Google/Brevo/traffic credentials in Render environment settings when those features are required.

Existing Render services can be redeployed automatically by entering their Deploy Hook URLs when the BAT asks.
