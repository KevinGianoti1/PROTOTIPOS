#!/bin/bash

# Script de Configuração Automática para Oracle Cloud (Ubuntu)
# Instala Docker, Docker Compose e configura Firewall

echo "🚀 Iniciando configuração do servidor..."

# 1. Atualizar sistema
echo "📦 Atualizando pacotes..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Instalar Docker
echo "🐳 Instalando Docker..."
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# 3. Instalar Docker Compose
echo "🐙 Instalando Docker Compose..."
sudo apt-get install -y docker-compose-plugin

# 4. Configurar permissões do usuário (para não precisar de sudo no docker)
echo "👤 Configurando permissões..."
sudo usermod -aG docker $USER

# 5. Configurar Firewall (Oracle usa iptables persistente)
echo "🔥 Configurando Firewall..."
# Permitir SSH (22), HTTP (80), HTTPS (443) e Porta da App (3000)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save

echo "✅ Configuração concluída!"
echo "⚠️  Por favor, SAIA e ENTRE novamente no SSH para as permissões do Docker funcionarem."
