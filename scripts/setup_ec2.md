# I should make this into a script... maybe later

```bash
sudo yum install postgresql15 -y

sudo yum update -y && sudo yum install -y docker && sudo service docker start && sudo usermod -aG docker ec2-user

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose

sudo yum update && sudo yum install -y git

ssh-keygen -t ed25519 -C "email_address"

eval "$(ssh-agent -s)" && ssh-add github

ssh -T git@github.com

git clone --branch dev --single-branch git@github.com:emily-flambe/list-cutter.git

cd list-cutter

vim .env

docker-compose -f docker-compose.web-dev.yml pull

docker-compose -f docker-compose.web-dev.yml up -d

```

# Neo4j instance

First, install docker.

```bash
sudo yum install docker -y
sudo service docker start
sudo usermod -aG docker ec2-user
```

To Attach an EBS Volume for data persistence:

Step 1: Create an EBS volume and attach it to your EC2 instance. Name the volume `/dev/sdf`.
Step 2: SSH into your EC2 instance, then format and mount the EBS volume. For example:
```bash 
sudo mkfs -t ext4 /dev/sdf
sudo mkdir /mnt/neo4j-data
sudo mount /dev/sdf /mnt/neo4j-data
echo '/dev/sdf /mnt/neo4j-data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
```

Verify that the volume is mounted. (Look for `/dev/xvdf` mounted on `/mnt/neo4j-data`.)

```bash
df -h
```

## Launch Neo4j container

```bash
docker run \
  --name neo4j \
  -p7474:7474 -p7687:7687 \
  -v /mnt/neo4j-data:/data \
  -d \
  neo4j:latest
  
```

#SSH port forwarding to access Neo4j from local machine

From local machine:

```bash
ssh -i admin.pem -L 7474:$NEO4J_HOST:7474 ec2-user@$BASTION_HOST
```

Then access the Neo4j browser at http://localhost:7474 . EASY MONEY.


## setting up EBS volume for file uploads

```bash
sudo mkfs -t ext4 /dev/sdg
sudo mkdir /mnt/user-files
sudo mount /dev/sdg /mnt/user-files
echo '/dev/sdg /mnt/user-files ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
```

```bash
sudo vim /etc/fstab
```

