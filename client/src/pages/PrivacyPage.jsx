import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-navy-900 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="AgendarAdv" className="h-8 w-8 object-contain" />
          <span className="text-white font-bold text-lg">
            Agendar<span className="text-brand-500">Adv</span>
          </span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-extrabold text-navy-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: maio de 2025</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">1. Quem somos</h2>
            <p>
              O AgendarAdv é uma plataforma de gestão para advogados brasileiros. Esta política descreve como
              coletamos, usamos, armazenamos e protegemos seus dados pessoais em conformidade com a Lei Geral de
              Proteção de Dados (LGPD — Lei 13.709/2018) e com as políticas de privacidade dos serviços integrados
              à plataforma, incluindo os serviços do Google LLC.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">2. Dados que Coletamos</h2>
            <p className="mb-2"><strong>Dados do advogado (usuário da plataforma):</strong></p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 mb-4">
              <li>Nome completo, e-mail e número de WhatsApp (fornecidos no cadastro)</li>
              <li>Foto de perfil e logotipo do escritório (enviados voluntariamente)</li>
              <li>Dados de endereço do escritório (opcionais)</li>
              <li>Dados de navegação e uso da plataforma (logs técnicos)</li>
            </ul>
            <p className="mb-2"><strong>Dados obtidos via Google (quando o advogado conecta sua conta Google):</strong></p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 mb-4">
              <li>Nome completo, endereço de e-mail e foto de perfil (fornecidos pelo Google OAuth para autenticação)</li>
              <li>Token de autorização para acesso à API do Google Calendar (armazenado de forma segura e criptografada)</li>
              <li>Dados dos eventos criados pelo AgendarAdv na agenda do advogado: título, data, horário, local e link de videochamada</li>
            </ul>
            <p className="mb-2"><strong>Dados inseridos pelo advogado (sobre seus clientes):</strong></p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Nome, e-mail e telefone dos clientes finais</li>
              <li>Descrições de consultas e demandas jurídicas</li>
              <li>Histórico de agendamentos e pagamentos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">3. Como Usamos os Dados</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Prestação do serviço de agendamento, gestão e cobranças</li>
              <li>Autenticação segura via Google OAuth (login com conta Google)</li>
              <li>Criação automática de eventos de consulta jurídica na Google Agenda do advogado</li>
              <li>Geração de links do Google Meet para consultas realizadas de forma online</li>
              <li>Envio de notificações transacionais (confirmações, alertas de agendamento)</li>
              <li>Melhoria contínua da plataforma com base em dados agregados e anonimizados</li>
              <li>Comunicação sobre atualizações relevantes do serviço</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de marketing.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">4. Integração com Serviços Google</h2>
            <p className="mb-3">
              O AgendarAdv oferece integração opcional com os seguintes serviços do Google LLC. Essa integração
              é habilitada exclusivamente pelo advogado, por meio de autorização explícita via OAuth 2.0.
            </p>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="font-semibold text-navy-900 mb-1">Google Login (OAuth 2.0)</p>
                <p className="text-gray-600">
                  Permite ao advogado autenticar-se na plataforma com sua conta Google, sem necessidade de senha.
                  Os dados acessados são: nome, e-mail e foto de perfil. Esses dados são usados exclusivamente
                  para identificação e criação/atualização do perfil do advogado na plataforma.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="font-semibold text-navy-900 mb-1">Google Calendar API</p>
                <p className="text-gray-600 mb-2">
                  Com autorização do advogado, o AgendarAdv acessa a API do Google Calendar para:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li><strong>Criar</strong> eventos de consulta jurídica na agenda principal do advogado quando um agendamento é confirmado</li>
                  <li><strong>Incluir</strong> automaticamente links do Google Meet nos eventos criados, para consultas online</li>
                </ul>
                <p className="mt-2 text-gray-600">
                  O AgendarAdv <strong>não lê, não modifica e não exclui</strong> eventos preexistentes na agenda do advogado.
                  O acesso é restrito ao escopo <code className="bg-gray-100 px-1 rounded text-xs">calendar.events</code>,
                  que permite apenas a criação de novos eventos.
                </p>
                <p className="mt-2 text-gray-600">
                  Os dados do cliente final (nome, e-mail) podem ser incluídos no evento do Google Calendar
                  como participante convidado, exclusivamente para fins de envio do convite de reunião.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-navy-900 mb-1">Revogação de acesso</p>
                <p className="text-gray-600">
                  O advogado pode desconectar a integração com Google a qualquer momento nas Configurações da plataforma
                  (aba Google). Isso encerra o acesso do AgendarAdv à Google Agenda. O acesso também pode ser revogado
                  diretamente na conta Google em:{' '}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"
                    className="text-navy-700 hover:underline">
                    myaccount.google.com/permissions
                  </a>.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500">
              O uso de informações recebidas das APIs do Google está sujeito à{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank"
                rel="noopener noreferrer" className="text-navy-700 hover:underline">
                Política de Dados do Usuário dos Serviços de API do Google
              </a>
              , incluindo os requisitos de Uso Limitado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">5. Compartilhamento com Terceiros</h2>
            <p>Utilizamos os seguintes serviços de terceiros para operar a plataforma:</p>
            <div className="mt-3 space-y-2">
              {[
                ['Supabase', 'Banco de dados, autenticação e armazenamento de arquivos (servidores na região de São Paulo)'],
                ['Google LLC', 'Autenticação OAuth e Google Calendar API (consulte a seção 4 para detalhes completos)'],
                ['Stripe', 'Processamento de pagamentos de consultas e repasse aos advogados via Stripe Connect'],
                ['Resend', 'Envio de e-mails transacionais (confirmações de agendamento e alertas)'],
                ['Twilio', 'Envio de notificações via WhatsApp para o advogado (quando habilitado nas configurações)'],
              ].map(([name, desc]) => (
                <div key={name} className="flex gap-3 bg-gray-100 rounded-lg p-3">
                  <span className="font-semibold text-navy-900 w-24 flex-shrink-0">{name}</span>
                  <span className="text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3">
              Cada um desses serviços possui sua própria política de privacidade e está sujeito à legislação
              aplicável ao seu país de operação. O compartilhamento de dados com esses serviços é restrito ao
              mínimo necessário para a prestação do serviço contratado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">6. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores na região de São Paulo (Brasil) via Supabase.
              Adotamos as seguintes medidas de segurança:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Criptografia em trânsito (HTTPS/TLS) e em repouso</li>
              <li>Row Level Security (RLS) no banco de dados — cada advogado acessa somente seus dados</li>
              <li>Autenticação por JWT com expiração automática</li>
              <li>Tokens de acesso OAuth (Google) armazenados de forma criptografada, nunca expostos ao cliente</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">7. Retenção de Dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa. Após o cancelamento da conta, os dados são
              retidos por 30 dias para possibilitar eventual recuperação e, decorrido esse prazo, são excluídos
              permanentemente dos sistemas do AgendarAdv. Tokens de acesso ao Google são excluídos imediatamente
              após a desconexão da integração.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">8. Seus Direitos (LGPD)</h2>
            <p>Como titular de dados, você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Confirmar a existência e acessar seus dados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação dos dados</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço</li>
              <li>Revogar consentimento a qualquer momento, inclusive a integração com Google</li>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato pelo e-mail:{' '}
              <a href="mailto:privacidade@agendar.adv.br" className="text-navy-700 hover:underline">
                privacidade@agendar.adv.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">9. Cookies</h2>
            <p>
              O AgendarAdv utiliza cookies e armazenamento local exclusivamente para fins técnicos: manter a sessão
              autenticada e armazenar preferências de interface. Não utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900 mb-3">10. Alterações nesta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Mudanças relevantes serão comunicadas por e-mail
              com antecedência mínima de 15 dias. A versão vigente estará sempre disponível em{' '}
              <Link to="/privacidade" className="text-navy-700 hover:underline">agendar.adv.br/privacidade</Link>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 px-6 text-center text-gray-400 text-xs">
        © {new Date().getFullYear()} AgendarAdv ·{' '}
        <Link to="/termos" className="hover:text-navy-700 transition-colors">Termos de Uso</Link>
      </footer>
    </div>
  )
}
