-- Create database and user if needed
CREATE DATABASE IF NOT EXISTS retaj_rms;
CREATE USER IF NOT EXISTS retaj_user WITH PASSWORD 'retaj_pass';
GRANT ALL PRIVILEGES ON DATABASE retaj_rms TO retaj_user;