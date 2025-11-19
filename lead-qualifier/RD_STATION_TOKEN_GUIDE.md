# 🔑 Como Obter o Token de API do RD Station CRM

O token que você forneceu (`63d3f64aa6528000185e5de0`) parece ser um ID de objeto do MongoDB, não um token de API válido.

## 📋 Passos para Gerar o Token Correto:

### 1. Acesse o RD Station CRM
- Faça login na sua conta: https://crm.rdstation.com

### 2. Vá para o Perfil
- Clique no seu **nome de usuário** (canto superior direito)
- Selecione **"Perfil"** no menu suspenso

### 3. Localize o Token
- Procure pela seção **"Token da instância"** ou **"Token de API"**
- Se for administrador, pode estar em: **Configurações → Preferências → Token de API**

### 4. Gere o Token
- Se ainda não tiver um token, clique em **"Gerar Token"**
- Se já existe, ele será exibido

### 5. Copie o Token
- Copie o código completo do token
- O token correto geralmente é uma string longa, parecida com:
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ...
  ```

## ⚙️ Como Configurar Após Obter o Token:

1. Abra o arquivo `.env` na pasta do projeto
2. Substitua o valor de `RD_STATION_API_TOKEN` pelo token correto
3. Salve o arquivo
4. Reinicie o servidor (`npm start`)

## ✅ Verificação

Quando configurado corretamente, você verá no console:
```
✅ RD Station configurado: SIM
```

E poderá criar deals automaticamente no CRM!

---

**Aguardando o token correto para continuar a configuração.** 🔑
