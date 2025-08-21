# Sistema de Gestão - Consultório Ideiva

Sistema completo de gestão para consultório multidisciplinar desenvolvido com React, TypeScript e Supabase.

## 🎯 Sobre o Projeto

Este sistema foi desenvolvido para facilitar a gestão completa de consultórios multidisciplinares, oferecendo controle de profissionais, agendamentos, financeiro e relatórios em uma interface moderna e intuitiva.

## 🚀 Funcionalidades

- **Dashboard** - Visão geral dos atendimentos e métricas
- **Profissionais** - Cadastro e gestão de profissionais
- **Agenda** - Sistema de agendamento e controle de atendimentos
- **Financeiro** - Controle de receitas e despesas
- **Relatórios** - Análises e estatísticas detalhadas

### Funcionalidades Detalhadas

#### 📊 Dashboard
- Resumo de atendimentos do dia, semana e mês
- Métricas de receita em tempo real
- Lista de próximos agendamentos
- Indicadores de performance

#### 👥 Gestão de Profissionais
- Cadastro completo com foto, especialidade e valores
- Controle de ativação/desativação
- Gestão de comissões e repasses
- Histórico de atendimentos por profissional

#### 📅 Sistema de Agenda
- Criação de jornadas de trabalho flexíveis
- Agendamento rápido de pacientes
- Controle de status dos atendimentos (agendado, em andamento, concluído)
- Histórico completo de atendimentos
- Controle de tempo real dos atendimentos

#### 💰 Controle Financeiro
- Registro automático de receitas por atendimento
- Controle manual de despesas
- Cálculo automático de comissões
- Relatórios financeiros detalhados
- Controle de repasses para profissionais

#### 📈 Relatórios
- Estatísticas de atendimentos por período
- Análise de performance por profissional
- Relatórios de receita e despesas
- Taxa de conclusão de atendimentos
- Métricas de crescimento

## 🛠️ Tecnologias

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Database:** Supabase
- **Build:** Vite

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase (opcional - funciona com dados mock)

## 📦 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/consultorio-ideiva.git
cd consultorio-ideiva
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (opcional):
```bash
# Crie um arquivo .env na raiz do projeto (opcional)
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```
> **Nota:** O sistema funciona sem configuração do Supabase usando dados de demonstração.

4. Execute o projeto:
```bash
npm run dev
```

5. Acesse no navegador:
```
http://localhost:5173
```

## 🗄️ Banco de Dados

O projeto utiliza Supabase como backend. Para configurar:

1. Crie uma conta no [Supabase](https://supabase.com)
2. Crie um novo projeto
3. Execute as migrações SQL da pasta `supabase/migrations/` no SQL Editor do Supabase
4. Configure as variáveis de ambiente no arquivo `.env`

### Estrutura do Banco

- **professionals** - Dados dos profissionais
- **patients** - Cadastro de pacientes
- **appointment_journeys** - Jornadas de trabalho
- **appointment_slots** - Slots de agendamento
- **appointment_history** - Histórico de atendimentos
- **transactions** - Transações financeiras
- **financial_entries** - Controle financeiro detalhado

## 🚀 Deploy

### Netlify
```bash
npm run build
# Faça upload da pasta dist/ para o Netlify
```

### Vercel
```bash
npm run build
# Conecte seu repositório GitHub ao Vercel
```

## 📱 PWA (Progressive Web App)

O sistema é configurado como PWA, permitindo:
- Instalação no dispositivo móvel
- Funcionamento offline básico
- Ícones personalizados
- Experiência nativa no mobile

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Gera build de produção
npm run preview      # Visualiza build de produção
npm run lint         # Executa linting do código
```

## 🎨 Personalização

### Cores e Tema
As cores principais podem ser alteradas no arquivo `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#2563eb',    // Azul principal
      secondary: '#64748b',  // Cinza secundário
      // Adicione suas cores personalizadas
    }
  }
}
```

### Logo e Ícones
- Substitua os ícones em `public/icon-192.png` e `public/icon-512.png`
- Atualize o `manifest.json` com informações da sua clínica

## 🐛 Solução de Problemas

### Erro de Conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- O sistema funciona sem Supabase usando dados mock

### Problemas de Build
```bash
# Limpe o cache e reinstale dependências
rm -rf node_modules package-lock.json
npm install
```

### Problemas de Performance
- Verifique se está usando a versão de produção (`npm run build`)
- Otimize imagens e assets

## 📊 Métricas e Analytics

O sistema inclui métricas internas para:
- Número de atendimentos por período
- Receita e despesas
- Performance por profissional
- Taxa de conclusão de atendimentos

## 🔒 Segurança

- Todas as consultas ao banco usam RLS (Row Level Security)
- Dados sensíveis são protegidos
- Validação de entrada em todos os formulários
- Sanitização de dados do usuário

## 📞 Suporte

Para suporte técnico:
- Abra uma issue no GitHub
- Consulte a documentação
- Verifique os logs do console do navegador


## 📱 Funcionalidades Principais

### Dashboard

- ✅ Resumo de atendimentos do dia
- ✅ Métricas de receita mensal
- ✅ Próximos agendamentos
- ✅ Indicadores de performance

### Gestão de Profissionais
- ✅ Cadastro completo de profissionais
- ✅ Controle de ativação/desativação
- ✅ Gestão de valores e especialidades
- ✅ Sistema de comissões

### Sistema de Agenda
- ✅ Criação de jornadas de atendimento
- ✅ Agendamento de pacientes
- ✅ Controle de status dos atendimentos
- ✅ Histórico completo
- ✅ Cronômetro de atendimentos

### Controle Financeiro
- ✅ Registro de receitas e despesas
- ✅ Cálculo automático de comissões
- ✅ Relatórios financeiros detalhados
- ✅ Controle de repasses

## 🗺️ Roadmap

### Próximas Funcionalidades
- [ ] Sistema de notificações
- [ ] Integração com WhatsApp
- [ ] Relatórios em PDF
- [ ] Sistema de backup automático
- [ ] Multi-tenancy (múltiplas clínicas)
- [ ] App mobile nativo
- [ ] Integração com calendário Google
- [ ] Sistema de lembretes por SMS

## 🤝 Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature:
   ```bash
   git checkout -b feature/nova-funcionalidade
   ```
3. Commit suas mudanças:
   ```bash
   git commit -m 'Adiciona nova funcionalidade'
   ```
4. Push para a branch:
   ```bash
   git push origin feature/nova-funcionalidade
   ```
5. Abra um Pull Request

### Padrões de Código
- Use TypeScript para type safety
- Siga os padrões do ESLint configurado
- Componentes devem ser funcionais com hooks
- Use Tailwind CSS para estilização
- Documente funções complexas

## 📄 Changelog

### v1.0.0 (2024-01-XX)
- ✅ Sistema completo de gestão
- ✅ Dashboard com métricas
- ✅ Gestão de profissionais
- ✅ Sistema de agendamentos
- ✅ Controle financeiro
- ✅ Relatórios detalhados
- ✅ PWA configurado
- ✅ Responsivo para mobile


## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

## 🏥 Sobre o Consultório Ideiva

Este sistema foi desenvolvido especificamente para consultórios multidisciplinares, com foco em:
- Nutrição
- Fonoaudiologia  
- Psicopedagogia
- Outras especialidades da saúde

## 🌟 Demonstração

O sistema funciona imediatamente após a instalação com dados de demonstração, permitindo que você explore todas as funcionalidades antes de configurar o banco de dados.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- Equipe do Consultório Ideiva pela confiança
- Comunidade React e TypeScript
- Supabase pela excelente plataforma
- Tailwind CSS pelo framework de estilização

## 📞 Contato

**Desenvolvido para Consultório Ideiva**

- 📧 Email: contato@consultorio-ideiva.com.br
- 🌐 Website: [www.consultorio-ideiva.com.br](https://consultorio-ideiva.com.br)
- 📱 WhatsApp: (11) 99999-9999

## 📈 Status do Projeto

![Status](https://img.shields.io/badge/Status-Ativo-brightgreen)
![Versão](https://img.shields.io/badge/Versão-1.0.0-blue)
![Licença](https://img.shields.io/badge/Licença-MIT-yellow)
![React](https://img.shields.io/badge/React-18+-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6)

---

⭐ **Se este projeto te ajudou, considere dar uma estrela!**

💡 **Sugestões e melhorias são sempre bem-vindas!**