FROM php:8.3-fpm

# Install necessary build tools and extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    wget \
    unzip \
    git \
    build-essential \
    libfreetype-dev \
    libpng-dev \
    libwebp-dev \
    libjpeg-dev \
    libxslt1-dev \
    default-libmysqlclient-dev \
    libzip-dev \
    libcurl4-openssl-dev \
    libonig-dev \
    libicu-dev \
    ca-certificates \
    curl && \
    docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp && \
    docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mysqli \
        mbstring \
        gd \
        intl \
        bcmath \
        soap \
        xsl \
        opcache \
        zip \
        curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Install Composer
RUN curl --insecure -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Set environment variables
ENV PHP_MEMORY_LIMIT=2G \
    COMPOSER_ALLOW_SUPERUSER=1

# Configure PHP memory limit
RUN echo "memory_limit = 2G" > /usr/local/etc/php/conf.d/memory-limit.ini

WORKDIR /var/www/html

# Disable TLS for Composer due to WSL 2 SSL issues
RUN composer config -g disable-tls true && \
    composer config -g secure-http false


# Configure PHP to use curl with proper certificate handling
RUN echo 'openssl.cafile=/etc/ssl/certs/ca-certificates.crt' >> /usr/local/etc/php/conf.d/ssl.ini && \
    echo 'curl.cainfo=/etc/ssl/certs/ca-certificates.crt' >> /usr/local/etc/php/conf.d/ssl.ini

EXPOSE 9000
