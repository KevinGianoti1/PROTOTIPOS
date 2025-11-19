# 🎯 Sistema de Qualificação Automática de Leads

Sistema de automação para validar leads de tráfego pago, consultar dados de CNPJ, verificar se a empresa está no Perfil de Cliente Ideal (PCI) baseado em CNAE, e criar oportunidades automaticamente no RD Station CRM.

## 🚀 Funcionalidades

- ✅ **Consulta automática de CNPJ** via BrasilAPI (gratuita)
- ✅ **Validação de CNAE** contra lista de 22 CNAEs do PCI
- ✅ **Integração com RD Station CRM** para criar oportunidades
- ✅ **Marcação automática** de leads não qualificados como "perdidos"
- ✅ **Interface web** para testes manuais
- ✅ **Webhook endpoint** para integração com formulários

## 📋 Pré-requisitos

- Node.js 14+ instalado
- Token de API do RD Station CRM (opcional para testes)

## 🔧 Instalação

1. **Instale as dependências:**
```bash
npm install
```

2. **Configure as variáveis de ambiente:**

Copie o arquivo `.env.example` para `.env`:
```bash
copy .env.example .env
```

Edite o arquivo `.env` e adicione seu token do RD Station:
```
RD_STATION_API_TOKEN=seu_token_aqui
```

> **Nota:** O sistema funciona em modo teste mesmo sem o token configurado!

## ▶️ Como Usar

### 1. Iniciar o servidor

```bash
npm start
```

O servidor iniciará em `http://localhost:3000`

### 2. Testar via Interface Web

Abra o navegador em `http://localhost:3000` e preencha o formulário com:
- CNPJ da empresa
- Nome do contato
- Telefone
- Origem (Site, Instagram, etc)

### 3. Integrar com Formulários

Envie requisições POST para o endpoint webhook:

**Endpoint:** `POST http://localhost:3000/webhook/lead`

**Payload:**
```json
{
  "cnpj": "00.000.000/0000-00",
  "nome": "João Silva",
  "telefone": "(11) 99999-9999",
  "origem": "Instagram"
}
```

**Resposta:**
```json
{
  "success": true,
  "resultado": {
    "lead": { ... },
    "empresa": { ... },
    "validacao": {
      "qualificado": true,
      "motivo": "CNAE principal está no PCI",
      "cnaeMatch": { ... }
    },
    "rdStation": {
      "success": true,
      "dealId": "123456"
    }
  }
}
```

## 📊 Fluxo de Validação

```
1. Lead preenche formulário (Site/Instagram)
   ↓
2. Sistema recebe dados via webhook
   ↓
3. Consulta CNPJ na BrasilAPI
   ↓
4. Valida CNAE contra lista do PCI (22 CNAEs)
   ↓
5. Cria oportunidade no RD Station
   ↓
6. Se qualificado → Mantém ativo
   Se não qualificado → Marca como "Perdido"
```

## 🎯 CNAEs Permitidos (PCI)

O sistema valida contra 22 CNAEs focados em:
- Comércio de ferragens e ferramentas
- Materiais de construção
- Material elétrico e hidráulico
- Máquinas e equipamentos industriais
- E outros relacionados

Ver lista completa em `config/cnaes.js`

## 📁 Estrutura do Projeto

```
lead-qualifier/
├── config/
│   └── cnaes.js              # Lista de CNAEs permitidos
├── services/
│   ├── cnpjService.js        # Consulta CNPJ (BrasilAPI)
│   ├── validationService.js  # Validação de CNAE
│   └── rdStationService.js   # Integração RD Station
├── utils/
│   └── logger.js             # Sistema de logs
├── public/
│   ├── index.html            # Interface web
│   └── styles.css            # Estilos
├── server.js                 # Servidor Express
├── package.json
└── .env                      # Configurações (não commitado)
```

## 🔌 Endpoints da API

### `POST /webhook/lead`
Recebe dados do lead e processa validação completa

### `GET /api/cnaes-permitidos`
Retorna lista de CNAEs permitidos

### `GET /health`
Health check do servidor

## 🧪 Testando

### Teste com CNPJ Real

Use CNPJs de empresas reais para testar. Exemplos de CNAEs que **PASSAM** na validação:
- 4744001 - Comércio varejista de ferragens
- 4672900 - Comércio atacadista de ferragens
- 4742300 - Comércio varejista de material elétrico

### Modo Teste (sem RD Station)

Se não configurar o token do RD Station, o sistema funciona em **modo teste**:
- ✅ Consulta CNPJ normalmente
- ✅ Valida CNAE normalmente
- ⚠️ Não cria deals no RD Station (apenas simula)

## 🔐 Segurança

- Nunca commite o arquivo `.env` (já está no `.gitignore`)
- Mantenha seu token do RD Station seguro
- Use HTTPS em produção

## 🚀 Próximos Passos

1. **Configurar RD Station:**
   - Obter token de API
   - Configurar IDs de pipeline/etapas
   - Configurar IDs de fontes (Instagram/Site)

2. **Integrar Formulários:**
   - Site: Configurar webhook no formulário
   - Meta Business: Configurar integração via Zapier/Make

3. **Deploy:**
   - Hospedar em servidor (Heroku, Railway, etc)
   - Configurar domínio
   - Ativar HTTPS

## 📞 Suporte

Para dúvidas ou problemas, verifique os logs do servidor.

---

**Desenvolvido para MAXIFORCE** 💼
