# 🚀 Deploy no Render.com - Guia Completo

## Pré-requisitos

1. ✅ Conta no GitHub (para hospedar o código)
2. ✅ Conta no Render.com (gratuita)
3. ✅ Chaves de API (OpenAI + RD Station)

---

## Passo 1: Preparar Repositório Git

### 1.1 Criar repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: `marcia-lead-qualifier` (ou outro)
3. **Deixe PRIVADO** (tem chaves sensíveis)
4. Não inicialize com README (já temos código)

### 1.2 Conectar projeto local ao GitHub

Execute no terminal (PowerShell):

```bash
cd "c:\Users\Maxiforce 01\OneDrive - MAXIFORCE\SALES OPS\PROTOTIPOS\lead-qualifier"

# Inicializa Git (se ainda não tiver)
git init

# Adiciona todos os arquivos
git add .

# Commit inicial
git commit -m "Setup inicial - Márcia Lead Qualifier"

# Conecta ao GitHub (substitua SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/marcia-lead-qualifier.git

# Envia para GitHub
git branch -M main
git push -u origin main
```

> **Importante:** Substitua `SEU_USUARIO` pelo seu username do GitHub!

---

## Passo 2: Criar .gitignore (Segurança)

**Verifique se já existe** o arquivo `.gitignore` com:

```
node_modules/
.env
database.sqlite
*.log
.DS_Store
```

Se não existir, vou criar para você.

---

## Passo 3: Deploy no Render

### 3.1 Criar conta no Render

1. Acesse: https://render.com
2. Clique em **"Get Started"**
3. Cadastre-se com GitHub (conecta automaticamente)

### 3.2 Criar Web Service

1. No Dashboard do Render, clique em **"New +"**
2. Selecione **"Web Service"**
3. Conecte seu repositório GitHub `marcia-lead-qualifier`
4. Clique em **"Connect"**

### 3.3 Configurar Web Service

Preencha os campos:

- **Name:** `marcia-dashboard` (ou qualquer nome)
- **Region:** `Oregon (US West)`
- **Branch:** `main`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Instance Type:** `Free`

### 3.4 Adicionar Volume Persistente (SQLite)

**IMPORTANTE:** Sem isso, o banco SQLite é apagado toda vez que o servidor reinicia!

1. Role até **"Disk"**
2. Clique em **"Add Disk"**
3. Configure:
   - **Name:** `data`
   - **Mount Path:** `/opt/render/project/src`
   - **Size:** `1 GB` (grátis)

### 3.5 Configurar Variáveis de Ambiente

Em **"Environment Variables"**, adicione:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `OPENAI_API_KEY` | Sua chave OpenAI |
| `RD_STATION_API_TOKEN` | Seu token RD Station |

> **Segurança:** Nunca commite as chaves no Git! Sempre configure no painel do Render.

### 3.6 Criar Web Service

Clique em **"Create Web Service"**

O Render vai:
1. ✅ Clonar seu repositório
2. ✅ Instalar dependências (`npm install`)
3. ✅ Iniciar servidor (`node server.js`)
4. ✅ Gerar URL pública (ex: `https://marcia-dashboard.onrender.com`)

**Tempo estimado:** 3-5 minutos

---

## Passo 4: Testar Deploy

### 4.1 Acessar Dashboard

Quando deploy terminar, você verá:

```
✅ Deploy successful
```

Clique no link gerado (ex: `https://marcia-dashboard.onrender.com`)

Você deve ver o dashboard rodando!

### 4.2 Verificar WhatsApp

O WhatsApp vai gerar QR code novamente (nova sessão). Para ver:

1. Acesse: `https://sua-url.onrender.com/qr`
2. Escaneie com WhatsApp
3. Aguarde "✅ WhatsApp conectado"

### 4.3 Testar API

Teste se o backend está funcionando:

```
GET: https://sua-url.onrender.com/api/dashboard/stats
```

Deve retornar JSON com estatísticas.

---

## Passo 5: Manutenção e Atualizações

### Atualizar código

Sempre que fizer mudanças:

```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

**Render faz deploy automático!** ✨

### Ver logs em tempo real

No painel do Render:
- Aba **"Logs"** → veja tudo que acontece
- Aba **"Events"** → histórico de deploys

### Restart manual

Se precisar reiniciar:
- Aba **"Manual Deploy"** → **"Clear build cache & deploy"**

---

## ⚠️ Limitações do Tier Grátis

- **Sleep após 15min inativo:** Primeira requisição demora ~30s para acordar
- **750h/mês:** ~31 dias de uptime (suficiente para 1 serviço)
- **512MB RAM:** OK para essa aplicação

### Como evitar sleep (opcional)

Use um serviço de "ping" gratuito:
- **UptimeRobot:** https://uptimerobot.com
- Faz ping no seu site a cada 5min
- Mantém acordado 24/7

---

## 🎯 URLs Importantes

Após deploy, guarde:

- **Dashboard:** `https://sua-url.onrender.com`
- **QR Code WhatsApp:** `https://sua-url.onrender.com/qr`
- **API Stats:** `https://sua-url.onrender.com/api/dashboard/stats`

---

## 🆘 Problemas Comuns

### "Application failed to respond"

**Causa:** Porta errada  
**Solução:** Certifique-se que `server.js` usa `process.env.PORT`:

```javascript
const PORT = process.env.PORT || 3000;
```

### "Module not found"

**Causa:** Dependência faltando  
**Solução:** Adicione no `package.json` e faça commit

### "Database locked"

**Causa:** Múltiplas instâncias acessando SQLite  
**Solução:** Use apenas 1 instância (tier grátis já faz isso)

---

## ✅ Checklist Final

- [ ] Repositório GitHub criado e código enviado
- [ ] `.gitignore` configurado (não vaza .env)
- [ ] Web Service criado no Render
- [ ] Volume persistente (`/opt/render/project/src`) adicionado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy concluído com sucesso
- [ ] Dashboard acessível pela URL pública
- [ ] WhatsApp conectado via QR code
- [ ] Testado criação de lead

---

**Pronto! Sua Márcia está online 24/7!** 🎉
