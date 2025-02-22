# list-cutter

A simple web app to cut lists, written with a Django backend and a React frontend.

This is deployed to the public internet!

👉 https://list-cutter.emilyflam.be 👈

## Local use

From the root directory, run:

```bash
make build
make up
```

Then open http://localhost:5173 in your browser.

## CSV List Cutter

After uploading a CSV, select the columns to keep.

Columns can be filtered using SQL-like conditions, for example:

- `<= 20`
- `!= "NY"`
- `BETWEEN 50 AND 100`
- `IN ('Alice', 'Bob')`

The list cutter applies these conditions while streaming CSV processing.

## Type checking and query validation

~~There is none! Deal with it.~~ Coming soon 👼

## Other file types

Coming soon 👼 (on a cosmic timescale)

## Planned features

- [ ] Type checking and query validation
- [ ] Other file types
- [ ] Download the filtered CSV
- [ ] Login/auth
- [ ] idk a lot, look at the Github issues lol

## Contributing

hmmmmm
