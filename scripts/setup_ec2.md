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
