# Fever Map API

## Development

The API is a simple Python Flask server with MariaDB backend. To spin up a local
development environment, simply run `docker-compose up --build`. The window will
keep displaying the logs from the environments. To abort, press Ctrl+C. If you
want to clear away the whole database volume before a fresh start, run
`docker-compose down --remove-orphans --volumes`.

Then the development server is running, you can browse it at
http://localhost:9000 or more importantly, run `curl` or other requests against
the API.

To access the MariaDB shell, simply run
`docker exec -it api_database_1 mysql -prootpass fevermap`.

## Production

1. Install and start a MariaDB server, with a custom user for the app and a
   database called 'fevermap'.

2. Install and configure a Nginx instance that handles HTTPS encryption,
   connection pooling, caching etc for backend on port 9000.

3. Start this API server by building a Docker container out of the sources and running it with:

        docker build -t fevermap/api .
        docker run -d --name fevermap_api --restart always -v "${PWD}:/app" -e FEVERMAP_API_DATABASE_URI="mysql://<user>:<password>@<database ip>/fevermap?charset=utf8mb4" -e ENV=production --expose 9000 fevermap/api

The `docker` commands can be invoked by a regular user (e.g via CI system). Setting up MariaDB and Nginx requires root.

See status with `docker logs --follow fevermap_api` and stop with `docker rm fevermap_api`. Modify at run time via `docker exec -it --user root fevermap_api bash`

## API endpoints and sample requests

Example request as JSON object:
```
curl -iLsS \
  -X POST \
  -H "Content-Type: application/json" -d '
  {
    "device_id":"1584694478571",
    "fever_status":true,
    "fever_temp":"38.0",
    "birth_year":"1996",
    "gender":"M",
    "location_country_code":"FI",
    "location_postal_code":"20100",
    "location_lng":"22.2833007",
    "location_lat":"60.4538845"
  } ' \
  http://localhost:9000/api/v0/submit
```


Example request as plain form data:
```
$ curl -iLsS \
    -X POST \
    --data device_id=1584605243123 \
    --data fever_status=true \
    --data fever_temp=37.1 \
    --data birth_year=1983 \
    --data gender=M \
    --data location_country_code=FI \
    --data location_postal_code=33100 \
    --data location_lng=61.497753 \
    --data location_lat=23.760954 \
    http://localhost:9000/api/v0/submit
```

Example responses:
```
{
    "success": true,
    "message": "Submission received.",
    "data": {
        "device_id": 1584605243333,
        "fever_status": true,
        "fever_temp": 37.0,
        "birth_year": 1983,
        "location_country_code": "FI",
        "location_postal_code": "33100",
        "location_lng": 61.497753,
        "location_lat": 23.760954,
        "history": [
            [
                "2020-03-19T23:36:03",
                true,
                37.0
            ]
        ]
    }
}
```

```
{
    "success": false,
    "message": "Do not submit new temp before 2020-03-20T11:36:03",
    "data": {
        "history": [
            [
                "2020-03-19T23:36:03",
                true,
                37.0
            ]
        ]
    }
}
```

```
{
    "success": false,
    "message": "Invalid payload rejected.",
    "data": [
        "gender",
        "Value not M or F"
    ]
}
```

## Data model

Defined via Python SQLAlchemy that translate into MariaDB tables;
```
MariaDB [fevermap]> describe submitters;
+--------------------+---------------+------+-----+---------+----------------+
| Field              | Type          | Null | Key | Default | Extra          |
+--------------------+---------------+------+-----+---------+----------------+
| id                 | int(11)       | NO   | PRI | NULL    | auto_increment |
| timestamp_created  | datetime      | NO   |     | NULL    |                |
| timestamp_modified | datetime      | NO   |     | NULL    |                |
| device_id          | bigint(20)    | YES  | UNI | NULL    |                |
| birth_year         | smallint(6)   | YES  |     | NULL    |                |
| gender             | enum('M','F') | YES  |     | NULL    |                |
+--------------------+---------------+------+-----+---------+----------------+

MariaDB [fevermap]> select * from submitters;
+----+---------------------+---------------------+---------------+------------+--------+
| id | timestamp_created   | timestamp_modified  | device_id     | birth_year | gender |
+----+---------------------+---------------------+---------------+------------+--------+
|  1 | 2020-03-19 23:36:03 | 2020-03-19 23:36:03 | 1584605243333 |       1983 | M      |
+----+---------------------+---------------------+---------------+------------+--------+

MariaDB [fevermap]> describe submissions;
+-----------------------+-------------+------+-----+---------+----------------+
| Field                 | Type        | Null | Key | Default | Extra          |
+-----------------------+-------------+------+-----+---------+----------------+
| id                    | int(11)     | NO   | PRI | NULL    | auto_increment |
| timestamp_created     | datetime    | NO   |     | NULL    |                |
| timestamp_modified    | datetime    | NO   |     | NULL    |                |
| fever_status          | tinyint(1)  | YES  |     | NULL    |                |
| fever_temp            | float       | YES  |     | NULL    |                |
| location_country_code | varchar(2)  | YES  |     | NULL    |                |
| location_postal_code  | varchar(10) | YES  |     | NULL    |                |
| location_lng          | int(11)     | YES  |     | NULL    |                |
| location_lat          | int(11)     | YES  |     | NULL    |                |
| submitter_id          | int(11)     | YES  | MUL | NULL    |                |
+-----------------------+-------------+------+-----+---------+----------------+

MariaDB [fevermap]> select * from submissions;
+----+---------------------+---------------------+--------------+------------+-----------------------+----------------------+--------------+--------------+--------------+
| id | timestamp_created   | timestamp_modified  | fever_status | fever_temp | location_country_code | location_postal_code | location_lng | location_lat | submitter_id |
+----+---------------------+---------------------+--------------+------------+-----------------------+----------------------+--------------+--------------+--------------+
|  1 | 2020-03-19 23:36:03 | 2020-03-19 23:36:03 |            1 |         37 | FI                    | 33100                |           61 |           24 |            1 |
+----+---------------------+---------------------+--------------+------------+-----------------------+----------------------+--------------+--------------+--------------+
```