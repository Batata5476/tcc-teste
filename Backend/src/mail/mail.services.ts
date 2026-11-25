import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Função base: faz o disparo HTTP REST direto para a API da Brevo
   */
  private async sendEmail(toEmail: string, toName: string, subject: string, htmlContent: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const senderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL');
    const senderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Sistema Coopera';

    if (!apiKey || !senderEmail) {
      this.logger.warn('BREVO_API_KEY ou BREVO_SENDER_EMAIL não estão definidos no .env!');
      return false;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail, name: toName }],
          subject: subject,
          htmlContent: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(`Erro ao disparar e-mail via Brevo: ${JSON.stringify(errorData)}`);
        return false;
      }

      this.logger.log(`E-mail enviado com sucesso para ${toEmail}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Erro de conexão com a Brevo: ${error.message}`);
      return false;
    }
  }

  private escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Template Moderno de Primeiro Acesso (Convite para Colaborador)
   */
  async sendFirstAccessEmail(toEmail: string, userName: string, activationCode: string, rawToken: string) {
    const safeName = this.escapeHtml(userName);
    const subject = 'Convite de Acesso à Plataforma - Sistema Coopera';
    
    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite Coopera</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F1F5F9; padding: 35px 15px;">
        <tr>
          <td align="center">
            <!-- CONTAINER PRINCIPAL -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
              
              <!-- TOPO / HEADER COM GRADIENTE -->
              <tr>
                <td style="background: linear-gradient(135deg, #285A71 0%, #1A3C4D 100%); padding: 40px 30px; text-align: center;">
                  <div style="display: inline-block; background-color: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 20px; padding: 5px 14px; margin-bottom: 14px;">
                    <span style="color: #E2E8F0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Acesso Corporativo</span>
                  </div>
                  <h1 style="color: #FFFFFF; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Sistema Coopera</h1>
                  <p style="color: #CBD5E1; margin: 8px 0 0 0; font-size: 14px;">Gestão de Equipes, Tarefas e Produtividade</p>
                </td>
              </tr>

              <!-- CONTEÚDO PRINCIPAL -->
              <tr>
                <td style="padding: 35px 35px 25px 35px;">
                  <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 12px 0; font-weight: 600;">
                    Olá, ${safeName}! 👋
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                    Você foi convidado(a) para fazer parte da plataforma <strong>Coopera</strong>. Com sua conta ativada, você terá acesso ao registro de ponto, controle de tarefas, comunicação interna e benefícios da empresa.
                  </p>

                  <!-- PASSO A PASSO -->
                  <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin-bottom: 25px;">
                    <div style="font-size: 13px; font-weight: 700; color: #285A71; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                      Como ativar sua conta em 3 passos:
                    </div>
                    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px; color: #334155; line-height: 1.5;">
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px; font-weight: bold; color: #285A71;">1.</td>
                        <td style="padding: 4px 0;">Abra o aplicativo ou acesse a página de login do Coopera.</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px; font-weight: bold; color: #285A71;">2.</td>
                        <td style="padding: 4px 0;">Clique no botão <strong>"Primeiro acesso"</strong>.</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 24px; font-weight: bold; color: #285A71;">3.</td>
                        <td style="padding: 4px 0;">Insira as credenciais temporárias abaixo e cadastre sua senha definitiva.</td>
                      </tr>
                    </table>
                  </div>

                  <!-- CARDS DE CÓDIGO E TOKEN -->
                  <div style="margin-bottom: 25px;">
                    <!-- Código de Ativação -->
                    <div style="background-color: #F1F5F9; border-left: 4px solid #285A71; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px;">
                      <div style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">
                        Código de Ativação
                      </div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 700; color: #285A71; letter-spacing: 2px; margin-top: 4px;">
                        ${activationCode}
                      </div>
                    </div>

                    <!-- Token de Primeiro Acesso -->
                    <div style="background-color: #F1F5F9; border-left: 4px solid #0EA5E9; border-radius: 8px; padding: 14px 18px;">
                      <div style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">
                        Token de Primeiro Acesso
                      </div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 700; color: #0284C7; letter-spacing: 2px; margin-top: 4px;">
                        ${rawToken}
                      </div>
                    </div>
                  </div>

                  <!-- AVISO DE EXPIRAÇÃO / SEGURANÇA -->
                  <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-bottom: 15px;">
                    <p style="margin: 0; font-size: 13px; color: #92400E; line-height: 1.4;">
                      ⏱️ <strong>Atenção:</strong> Por motivos de segurança, estes dados de ativação expiram automaticamente em <strong>48 horas</strong>.
                    </p>
                  </div>

                </td>
              </tr>

              <!-- RODAPÉ -->
              <tr>
                <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 30px; text-align: center;">
                  <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">
                    Este é um e-mail automático gerado pelo <strong>Sistema Coopera</strong>. Não responda a esta mensagem.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                    © 2026 Coopera Tecnologia e Gestão Integrada. Todos os direitos reservados.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    return this.sendEmail(toEmail, userName, subject, html);
  }

  /**
   * Template Moderno de Recuperação de Senha
   */
  async sendPasswordResetEmail(toEmail: string, userName: string, activationCode: string, rawToken: string) {
    const safeName = this.escapeHtml(userName);
    const subject = 'Redefinição de Senha - Sistema Coopera';

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F1F5F9; padding: 35px 15px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #285A71 0%, #1A3C4D 100%); padding: 35px 30px; text-align: center;">
                  <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">Sistema Coopera</h1>
                  <p style="color: #CBD5E1; margin: 6px 0 0 0; font-size: 13px;">Segurança e Redefinição de Acesso</p>
                </td>
              </tr>

              <!-- CONTEÚDO -->
              <tr>
                <td style="padding: 35px 35px 25px 35px;">
                  <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 12px 0; font-weight: 600;">
                    Olá, ${safeName}
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                    Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Coopera</strong>. Insira os dados abaixo na tela de redefinição para cadastrar sua nova senha:
                  </p>

                  <!-- CARDS -->
                  <div style="margin-bottom: 25px;">
                    <div style="background-color: #F1F5F9; border-left: 4px solid #285A71; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px;">
                      <div style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase;">Código de Confirmação</div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 700; color: #285A71; letter-spacing: 2px; margin-top: 4px;">
                        ${activationCode}
                      </div>
                    </div>

                    <div style="background-color: #F1F5F9; border-left: 4px solid #0EA5E9; border-radius: 8px; padding: 14px 18px;">
                      <div style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase;">Token de Redefinição</div>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 700; color: #0284C7; letter-spacing: 2px; margin-top: 4px;">
                        ${rawToken}
                      </div>
                    </div>
                  </div>

                  <p style="color: #64748B; font-size: 13px; line-height: 1.5; margin: 0;">
                    🛡️ Se você não solicitou a alteração de sua senha, desconsidere esta mensagem. Sua conta permanece segura.
                  </p>
                </td>
              </tr>

              <!-- RODAPÉ -->
              <tr>
                <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 30px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                    © 2026 Coopera Tecnologia e Gestão Integrada.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    return this.sendEmail(toEmail, userName, subject, html);
  }
}
