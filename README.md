# list-cutter

> **Note:** While the GitHub repository is named "list-cutter", the preferred identity for all Cloudflare deployments and resources is "cutty".

A simple web app to cut lists, written with a Django backend and a React frontend.

# How to run locally

```bash
make build
make up
```

Then open http://localhost:5173 in your browser. You're done :tada:

## Web deployment?

This ~~is~~ **was** deployed to the public internet! But then I ran out of AWS Free Tier credits, so I pulled it down. Maybe it will come back someday.

If and when it comes back, you can access it at:

👉 https://list-cutter.emilyflam.be 👈

## CSV List Cutter BASIC (No account needed)

After uploading a CSV, select the columns to keep.

Columns can be filtered using SQL-like conditions, for example:

- `<= 20`
- `!= "NY"`
- `BETWEEN 50 AND 100`
- `IN ('Alice', 'Bob')`

The list cutter applies these conditions while streaming the CSV into a new CSV, which you can download, if that sparks joy.

## CSV List Cutter PRO (Account needed)

If you create an account and log in, you can save files in your own personal little file manager, including files you cut from other files! Wow.

## Planned features

Check out the Github issues.

## Contributing

hmmmmm
