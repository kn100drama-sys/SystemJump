# Gerente Afiliado — PWA

## Arquivos da pasta GERENTE
| Arquivo | Função |
|---------|--------|
| `index.html` | App principal (login, dashboard, jogadores, depósitos) |
| `manifest.json` | Torna o site instalável como app |
| `firebase-messaging-sw.js` | Service Worker FCM — recebe push mesmo com app fechado |
| `icon-192.png` | Ícone do app (você adiciona) |
| `icon-512.png` | Ícone splash (você adiciona) |

## Deploy

1. Faça upload da pasta inteira no **Netlify** ou qualquer host com HTTPS
2. Adicione os ícones `icon-192.png` e `icon-512.png` (fundo preto, pirâmide dourada)
3. Adicione o domínio do host em `allowedOrigins` no seu backend Node.js

## Firebase — Passos para notificações funcionarem

### 1. Ative Cloud Messaging no Firebase Console
- Acesse https://console.firebase.google.com → Projeto **bk-jump**
- Vá em **Project Settings → Cloud Messaging**
- Copie a **VAPID key** (já configurada no app)

### 2. Adicione o domínio do PWA como "Authorized domain"
- Firebase Console → Authentication → Settings → Authorized domains
- Adicione o domínio do Netlify (ex: gerente.netlify.app)

### 3. Instalar o app no celular
- Acesse o site no Chrome (Android) ou Safari (iOS)
- Aparecerá o banner "Adicionar à tela inicial" → instale
- Abra o app instalado → Configurações → "Ativar notificações push"
- Aceite a permissão → pronto!

### 4. Testar envio de push (via Firebase Console)
- Firebase Console → Cloud Messaging → "Send your first message"
- Ou via API usando o token FCM salvo no localStorage do usuário

## CORS
Adicione o domínio do PWA em allowedOrigins no seu backend:
```js
const allowedOrigins = [
  'https://gerente.seudominio.com',
  // ...
];
```

## Como funciona o polling
- A cada 15 segundos o app consulta `/api/indicacao/info`
- Se detecta novo indicado ou novo depósito: dispara toast + push local
- Com FCM ativo: também recebe push quando o app está **fechado**
