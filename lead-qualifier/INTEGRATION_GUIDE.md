# 📋 Guia de Integração com Formulários

Este guia mostra como conectar o sistema de qualificação de leads com seus formulários do Site e Instagram/Meta Business.

---

## 🌐 Opção 1: Formulário do Site (Direto)

### Passo 1: Adicionar JavaScript ao Formulário

No seu formulário HTML, adicione este código JavaScript:

```html
<form id="leadForm">
  <input type="text" name="cnpj" placeholder="CNPJ" required>
  <input type="text" name="nome" placeholder="Nome" required>
  <input type="tel" name="telefone" placeholder="Telefone" required>
  <input type="hidden" name="origem" value="Site">
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    cnpj: e.target.cnpj.value,
    nome: e.target.nome.value,
    telefone: e.target.telefone.value,
    origem: 'Site'
  };

  try {
    const response = await fetch('https://SEU-SERVIDOR.com/webhook/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    
    if (result.success) {
      alert('Lead enviado com sucesso!');
      e.target.reset();
    }
  } catch (error) {
    alert('Erro ao enviar lead');
  }
});
</script>
```

### Passo 2: Substituir URL

Substitua `https://SEU-SERVIDOR.com` pela URL do seu servidor em produção.

---

## 📱 Opção 2: Meta Business (Instagram/Facebook) via Zapier

### Passo 1: Criar Zap no Zapier

1. **Trigger:** Meta Lead Ads
   - Conecte sua conta do Meta Business
   - Selecione o formulário do Instagram/Facebook

2. **Action:** Webhooks by Zapier
   - Escolha "POST"
   - URL: `https://SEU-SERVIDOR.com/webhook/lead`
   - Payload Type: JSON
   - Data:
     ```json
     {
       "cnpj": "{{CNPJ do formulário}}",
       "nome": "{{Nome do formulário}}",
       "telefone": "{{Telefone do formulário}}",
       "origem": "Instagram"
     }
     ```

3. **Testar e Ativar**

---

## 🔧 Opção 3: Meta Business via Make (Integromat)

### Passo 1: Criar Cenário no Make

1. **Módulo 1:** Facebook Lead Ads - Watch Leads
   - Conecte sua conta
   - Selecione a página e formulário

2. **Módulo 2:** HTTP - Make a Request
   - URL: `https://SEU-SERVIDOR.com/webhook/lead`
   - Method: POST
   - Headers:
     - `Content-Type`: `application/json`
   - Body:
     ```json
     {
       "cnpj": "{{1.cnpj}}",
       "nome": "{{1.full_name}}",
       "telefone": "{{1.phone_number}}",
       "origem": "Instagram"
     }
     ```

3. **Ativar Cenário**

---

## 🚀 Opção 4: Google Forms + Google Apps Script

### Passo 1: Criar Formulário no Google Forms

Crie campos para:
- CNPJ
- Nome
- Telefone

### Passo 2: Adicionar Script

1. No Google Forms, vá em **Extensões > Apps Script**
2. Cole este código:

```javascript
function onFormSubmit(e) {
  const responses = e.namedValues;
  
  const payload = {
    cnpj: responses['CNPJ'][0],
    nome: responses['Nome'][0],
    telefone: responses['Telefone'][0],
    origem: 'Site'
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch('https://SEU-SERVIDOR.com/webhook/lead', options);
}
```

3. Configure o trigger:
   - **Tipo:** Do formulário
   - **Evento:** Ao enviar formulário

---

## 🔐 Segurança (Recomendado)

### Adicionar Autenticação ao Webhook

Modifique o `server.js` para aceitar um token de segurança:

```javascript
app.post('/webhook/lead', (req, res) => {
  const authToken = req.headers['x-auth-token'];
  
  if (authToken !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  // ... resto do código
});
```

No `.env`:
```
WEBHOOK_SECRET=seu_token_secreto_aqui
```

Nos formulários/integrações, adicione o header:
```
X-Auth-Token: seu_token_secreto_aqui
```

---

## 📊 Testando a Integração

### 1. Teste Manual com cURL

```bash
curl -X POST https://SEU-SERVIDOR.com/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "00.000.000/0001-91",
    "nome": "Teste",
    "telefone": "(11) 99999-9999",
    "origem": "Teste"
  }'
```

### 2. Teste com Postman

1. Crie nova requisição POST
2. URL: `https://SEU-SERVIDOR.com/webhook/lead`
3. Body (JSON):
   ```json
   {
     "cnpj": "00.000.000/0001-91",
     "nome": "Teste Postman",
     "telefone": "(11) 99999-9999",
     "origem": "Teste"
   }
   ```

---

## 🎯 Checklist de Deploy

Antes de colocar em produção:

- [ ] Servidor hospedado e rodando
- [ ] HTTPS configurado
- [ ] Token RD Station configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Webhook testado manualmente
- [ ] Integração com formulário testada
- [ ] Logs funcionando
- [ ] Monitoramento ativo

---

## 📞 Troubleshooting

### Erro: "CNPJ inválido"
- Verifique se o CNPJ está sendo enviado com 14 dígitos
- Pode ter formatação (pontos/traços) ou não

### Erro: "RD Station não configurado"
- Adicione `RD_STATION_API_TOKEN` no `.env`
- Reinicie o servidor

### Leads não aparecem no RD Station
- Verifique os logs do servidor
- Confirme que o token está correto
- Verifique se os IDs de pipeline/etapa estão configurados

---

**Precisa de ajuda?** Verifique os logs em tempo real:
```bash
npm start
```

Os logs mostrarão cada etapa do processamento! 📊
