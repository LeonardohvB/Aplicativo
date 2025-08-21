# 🚀 Como enviar o projeto para o GitHub

## 📋 Instruções passo a passo

### 1. **Baixar o projeto**
- Faça download de todos os arquivos do projeto
- Extraia em uma pasta no seu computador (ex: `consultorio-ideiva`)

### 2. **Abrir terminal na pasta do projeto**
- Windows: Shift + Clique direito na pasta → "Abrir janela do PowerShell aqui"
- Mac/Linux: Clique direito → "Abrir no Terminal"

### 3. **Executar comandos Git**

```bash
# Inicializar repositório Git
git init

# Configurar usuário (substitua pelos seus dados)
git config user.name "Seu Nome"
git config user.email "seu.email@gmail.com"

# Adicionar todos os arquivos
git add .

# Fazer o primeiro commit
git commit -m "Sistema de Gestão Consultório Multidisciplinar - Versão inicial

- Dashboard com métricas em tempo real
- Gestão completa de profissionais
- Sistema de agendamentos com jornadas
- Controle financeiro automatizado
- Relatórios detalhados
- PWA configurado
- Interface responsiva"

# Conectar com seu repositório
git remote add origin https://github.com/LeonardohvB/Multidisciplinar.git

# Verificar se há conteúdo no repositório remoto
git fetch origin

# Se o repositório estiver vazio, usar:
git push -u origin main

# Se já houver conteúdo, usar:
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### 4. **Se der erro de branch**

```bash
# Renomear branch para main
git branch -M main

# Tentar push novamente
git push -u origin main
```

### 5. **Se der erro de autenticação**

```bash
# Usar token do GitHub em vez de senha
# Quando pedir senha, use seu Personal Access Token do GitHub
```

## 🔧 Comandos alternativos se der problema

### Forçar push (use apenas se necessário):
```bash
git push -f origin main
```

### Verificar status:
```bash
git status
git remote -v
```

## ✅ Arquivos que serão enviados:

- Sistema completo React + TypeScript
- Configuração Tailwind CSS
- Hooks personalizados
- Componentes organizados
- Configuração PWA
- Documentação completa
- .gitignore configurado

## 🌐 Após enviar:

1. Acesse: https://github.com/LeonardohvB/Multidisciplinar
2. Configure deploy no Netlify/Vercel
3. Configure Supabase para dados reais

## 🆘 Se precisar de ajuda:

- Verifique se o Git está instalado: `git --version`
- Verifique se está na pasta correta: `ls` (Linux/Mac) ou `dir` (Windows)
- Certifique-se que o repositório existe no GitHub

---

**Importante:** Execute estes comandos no seu computador local onde o Git está instalado!