#!/bin/bash
set -e

echo "=========================================="
echo "Magento 2.4.7 + Tailwind Luna Auto-Install"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="db"
DB_NAME="magento"
DB_USER="magento"
DB_PASSWORD="magento123"
BASE_URL="${BASE_URL:-http://172.29.201.103:8888/}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456}"

# Step 1: Start containers
echo -e "${BLUE}Step 1: Starting Docker containers...${NC}"
docker-compose up -d
sleep 10
echo -e "${GREEN}✓ Containers started${NC}"

# Step 2: Wait for MySQL to be ready
echo -e "${BLUE}Step 2: Waiting for MySQL...${NC}"
for i in {1..30}; do
  if docker-compose exec -T db mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" 2>/dev/null; then
    echo -e "${GREEN}✓ MySQL ready${NC}"
    break
  fi
  echo "Waiting for MySQL... ($i/30)"
  sleep 2
done

# Step 3: Install Magento via Composer
echo -e "${BLUE}Step 3: Installing Magento 2.4.7 via Composer...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  composer config --global process-timeout 2000 && \
  composer config --global repositories.magento composerhttps://repo.magento.com && \
  composer config --global repo.packagist false && \
  composer create-project --repository-url='https://repo.magento.com/' \
  magento/project-community-edition:2.4.7 . \
  --no-interaction --ignore-platform-reqs 2>&1 | tail -30
" || docker-compose exec -T php bash -c "
  cd /var/www/html && \
  echo 'Attempting with HTTP fallback...' && \
  composer config --global repositories.magento '{\
    \"type\": \"composer\",\
    \"url\": \"https://repo.magento.com/\"\
  }' && \
  composer create-project magento/project-community-edition:2.4.7 . \
  --no-interaction --ignore-platform-reqs 2>&1 | tail -30
"
echo -e "${GREEN}✓ Magento downloaded${NC}"

# Step 4: Run Magento setup:install
echo -e "${BLUE}Step 4: Running Magento setup:install...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  bin/magento setup:install \
    --db-host=$DB_HOST \
    --db-name=$DB_NAME \
    --db-user=$DB_USER \
    --db-password='$DB_PASSWORD' \
    --base-url='$BASE_URL' \
    --admin-firstname=Admin \
    --admin-lastname=User \
    --admin-email='$ADMIN_EMAIL' \
    --admin-user='$ADMIN_USER' \
    --admin-password='$ADMIN_PASSWORD' \
    --search-engine=opensearch \
    --opensearch-host=elasticsearch \
    --opensearch-port=9200 \
    --no-interaction 2>&1 | tail -20
"
echo -e "${GREEN}✓ Magento installed${NC}"

# Step 5: Install Theme
echo -e "${BLUE}Step 5: Installing Tailwind Luna theme...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  composer require genaker/theme-frontend-tailwind-luna --ignore-platform-reqs 2>&1 | tail -10
"
echo -e "${GREEN}✓ Theme installed${NC}"

# Step 6: Enable Module and Setup
echo -e "${BLUE}Step 6: Enabling Tailwind Luna module...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  bin/magento module:enable Genaker_ThemeTailwindLuna && \
  bin/magento setup:upgrade --no-interaction 2>&1 | tail -10
"
echo -e "${GREEN}✓ Module enabled${NC}"

# Step 6b: Install Sample Data (Git Clone method - most reliable for 2.4.7)
echo -e "${BLUE}Step 6b: Installing Magento sample data...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  mkdir -p app/code/Magento && \
  mkdir -p /tmp/sample-data-repos && \
  cd /tmp/sample-data-repos && \
  git clone https://github.com/magento/magento2-sample-data.git 2>&1 | tail -5
"
echo -e "${GREEN}✓ Sample data repo cloned${NC}"

# Copy ALL sample data modules (30+)
echo -e "${BLUE}Step 6c: Setting up all sample data modules...${NC}"
docker-compose exec -T php bash -c "
  cd /tmp/sample-data-repos/magento2-sample-data && \
  echo 'Copying all sample data modules...' && \
  cp -r app/code/Magento/*SampleData /var/www/html/app/code/Magento/ 2>/dev/null || true && \
  echo 'Copying sample data media files...' && \
  cp -r pub/media/* /var/www/html/pub/media/ 2>/dev/null || true && \
  echo 'Sample data setup complete'
"

# Enable and setup sample data
echo -e "${BLUE}Step 6d: Enabling and running sample data migrations...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  echo 'Enabling all modules...' && \
  bin/magento module:enable --all > /dev/null 2>&1 && \
  echo 'Running setup:upgrade to load all fixture data...' && \
  bin/magento setup:upgrade --no-interaction 2>&1 | tail -20
"
echo -e "${GREEN}✓ Sample data modules enabled and fixtures loaded${NC}"

# Step 7: Set theme as default
echo -e "${BLUE}Step 7: Setting Tailwind Luna as default theme...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  THEME_ID=\$(bin/magento theme:list | grep -i 'tailwind.*luna' | grep -oP 'ID: \K[0-9]+' || echo '4') && \
  echo \"Setting theme ID: \$THEME_ID\" && \
  bin/magento config:set design/theme/theme_id \$THEME_ID && \
  bin/magento cache:flush
"
echo -e "${GREEN}✓ Theme set as default${NC}"

# Step 7b: Enable SEO URL rewrites (removes index.php from URLs)
echo -e "${BLUE}Step 7b: Enabling SEO-friendly URL rewrites...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  bin/magento config:set web/seo/use_rewrites 1 && \
  bin/magento cache:flush 2>&1 | grep -E 'Value was saved|Flushed'
"
echo -e "${GREEN}✓ URL rewrites enabled (web/seo/use_rewrites = 1)${NC}"

# Step 8: Deploy static files
echo -e "${BLUE}Step 8: Deploying static content...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  bin/magento setup:static-content:deploy -f --jobs 4 2>&1 | tail -10
"
echo -e "${GREEN}✓ Static files deployed${NC}"

# Step 9: Compile DI
echo -e "${BLUE}Step 9: Compiling dependency injection...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  bin/magento setup:di:compile 2>&1 | tail -10
"
echo -e "${GREEN}✓ DI compiled${NC}"

# Step 10: Fix permissions
echo -e "${BLUE}Step 10: Fixing file permissions...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  chown -R www-data:www-data var/ pub/static/ pub/media generated/ && \
  find var -type d -exec chmod 755 {} \; && \
  find var -type f -exec chmod 644 {} \; && \
  chmod -R 777 var/cache var/page_cache var/tmp var/log var/report var/session
"
echo -e "${GREEN}✓ Permissions fixed${NC}"

# Step 11: Reindex and flush cache
echo -e "${BLUE}Step 11: Reindexing search engine and flushing cache...${NC}"
docker-compose exec -T php bash -c "
  cd /var/www/html && \
  echo 'Reindexing catalog search...' && \
  bin/magento indexer:reindex catalogsearch_fulltext 2>&1 | tail -3 && \
  echo 'Flushing cache...' && \
  bin/magento cache:flush 2>&1 | tail -3
"
echo -e "${GREEN}✓ Reindex and cache flush complete${NC}"

# Step 12: Get admin URI
echo -e "${BLUE}Step 12: Getting admin URI...${NC}"
ADMIN_URI=$(docker-compose exec -T php bash -c "cd /var/www/html && bin/magento info:adminuri" | grep -oP '/admin_[a-z0-9]+')
echo -e "${GREEN}✓ Admin URI: $ADMIN_URI${NC}"

# Final Summary
echo ""
echo "=========================================="
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo "=========================================="
echo ""
echo "Storefront URL:     $BASE_URL"
echo "Admin URL:          ${BASE_URL}${ADMIN_URI}/"
echo "Admin Username:     $ADMIN_USER"
echo "Admin Password:     $ADMIN_PASSWORD"
echo ""
echo "Theme:              Tailwind Luna (Genaker)"
echo "Database:           $DB_NAME"
echo "Search Engine:      Elasticsearch 7.17 (OpenSearch)"
echo ""
echo "=========================================="
