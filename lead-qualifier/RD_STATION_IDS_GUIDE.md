# 🔧 Guia de Configuração de IDs do RD Station CRM

Como a API pode não estar retornando todos os dados automaticamente, você pode obter esses IDs manualmente através do painel do RD Station.

## 📋 IDs Necessários

### 1. **Pipeline ID** (Funil de Vendas)
- **O que é:** O funil onde os deals serão criados
- **Como obter:**
  1. Acesse o RD Station CRM
  2. Vá em **Negociações**
  3. Olhe na URL quando estiver visualizando um funil
  4. A URL será algo como: `https://crm.rdstation.com/deals?pipeline_id=XXXXX`
  5. Copie o ID que aparece após `pipeline_id=`

### 2. **Stage IDs** (Etapas do Funil)
- **O que é:** As etapas do funil (ex: Novo, Qualificado, Proposta, etc)
- **Como obter:**
  1. No RD Station CRM, vá em **Configurações → Funis**
  2. Clique no funil que você usa
  3. Para cada etapa, clique em **Editar**
  4. O ID aparecerá na URL: `stage_id=XXXXX`

**Etapas que precisamos:**
- **Etapa inicial** (onde leads qualificados entram)
- **Etapa "Perdido"** (onde leads não qualificados vão)

### 3. **Source IDs** (Fontes)
- **O que é:** De onde vem o lead (Instagram, Site, etc)
- **Como obter:**
  1. Vá em **Configurações → Fontes**
  2. Para cada fonte, clique em **Editar**
  3. O ID aparecerá na URL

**Fontes que precisamos:**
- **Instagram**
- **Site**

### 4. **Lost Reason ID** (Motivo de Perda)
- **O que é:** Por que o lead foi perdido
- **Como obter:**
  1. Vá em **Configurações → Motivos de Perda**
  2. Procure ou crie um motivo chamado **"CNAE fora do PCI"**
  3. Clique em **Editar**
  4. O ID aparecerá na URL

### 5. **User ID** (Vendedor Responsável) - Opcional
- **O que é:** Quem será responsável pelos leads
- **Como obter:**
  1. Vá em **Configurações → Usuários**
  2. Clique no usuário
  3. O ID aparecerá na URL

---

## ⚙️ Como Configurar no Sistema

Depois de obter os IDs, adicione no arquivo `.env`:

```env
# RD Station API Configuration
RD_STATION_API_TOKEN=63d3f64aa6528000185e5de0

# Pipeline e Etapas
RD_STATION_PIPELINE_ID=seu_pipeline_id_aqui
RD_STATION_STAGE_QUALIFICADO_ID=seu_stage_qualificado_id_aqui
RD_STATION_STAGE_PERDIDO_ID=seu_stage_perdido_id_aqui

# Fontes
RD_STATION_SOURCE_INSTAGRAM_ID=seu_source_instagram_id_aqui
RD_STATION_SOURCE_SITE_ID=seu_source_site_id_aqui

# Motivo de Perda
RD_STATION_LOST_REASON_ID=seu_lost_reason_id_aqui

# Vendedor Responsável (opcional)
RD_STATION_USER_ID=seu_user_id_aqui
```

---

## 🎯 Alternativa Mais Simples

Se você não conseguir os IDs facilmente, podemos:

1. **Deixar sem IDs por enquanto** - O sistema já está funcionando e criando deals
2. **Adicionar IDs depois** - Quando você tiver tempo de pegar no painel
3. **Usar valores padrão** - O RD Station vai usar as configurações padrão da conta

**O sistema JÁ FUNCIONA sem esses IDs!** Eles são apenas para ter mais controle sobre:
- Em qual funil criar
- Em qual etapa colocar
- Qual fonte marcar
- Qual motivo de perda usar

---

## 💡 Próximo Passo

**Opção 1:** Me passe os IDs que você conseguir obter manualmente e eu configuro

**Opção 2:** Deixamos assim por enquanto e você adiciona os IDs depois quando precisar

**O que você prefere fazer?** 😊
