FROM php:8.4-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev libjpeg62-turbo-dev libonig-dev libpng-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" curl gd mbstring pdo_mysql \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

# O limite da borda (Nginx) e do PHP precisa comportar o contrato público de
# avatar de 5 MiB mais o overhead do multipart.
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf \
    /etc/apache2/apache2.conf \
    /etc/apache2/conf-available/*.conf \
    && sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

COPY . /var/www/html

RUN mkdir -p \
        /var/www/html/storage/cache \
        /var/www/html/storage/logs \
        /var/www/html/storage/rate-limits \
        /var/www/html/storage/uploads/private \
    && chown -R www-data:www-data /var/www/html/storage

EXPOSE 80
