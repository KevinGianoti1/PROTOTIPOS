FROM node:18-alpine

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
