from neo4j import GraphDatabase
import os

uri = "bolt://host.docker.internal:7687"
password = os.getenv("NEO4J_PASSWORD")
driver = GraphDatabase.driver(uri, auth=("neo4j", password))  # Replace with your credentials

try:
    with driver.session() as session:
        result = session.run("RETURN 'Connected' AS message")
        print(result.single()["message"])
except Exception as e:
    print("Connection failed:", e)
finally:
    driver.close()
