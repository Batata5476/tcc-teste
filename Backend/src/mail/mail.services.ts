import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {}

  /**
   Função base: faz o disparo HTTP REST direto para o servidor da Brevo
   */
  private async sendEmail(toEmail: string, toName: string, subject: string, htmlContent: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const senderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL');
    const senderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Coopera';

    if (!apiKey || !senderEmail) {
      this.logger.warn('BREVO_API_KEY ou BREVO_SENDER_EMAIL não estão definidos no .env!');
      return false;
    }

    try {
      // Faz uma requisição POST na API REST do Brevo
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
   * Template de Primeiro Acesso (novo funcionário)
   */
  async sendFirstAccessEmail(toEmail: string, userName: string, activationCode: string, rawToken: string) {
    const safeName = this.escapeHtml(userName);
    const subject = 'Ativação de Conta - Sistema Coopera';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: auto; padding: 25px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #285A71;">Bem-vindo(a), ${safeName}!</h2>
        <p>Sua conta foi criada no <strong>Coopera</strong>. Para realizar o seu primeiro acesso e cadastrar sua senha, utilize os dados abaixo no aplicativo:</p>

        <div style="background-color: #f3f6f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Código de Ativação:</strong> <span style="font-size: 18px; color: #285A71; font-weight: bold;">${activationCode}</span></p>
          <p style="margin: 6px 0;"><strong>Token de Primeiro Acesso:</strong> <span style="font-size: 18px; color: #285A71; font-weight: bold;">${rawToken}</span></p>
        </div>

        <p style="color: #777; font-size: 12px;">Esses códigos expiram em 48 horas.</p>
      </div>
    `;

    return this.sendEmail(toEmail, userName, subject, html);
  }

  /**
   * Template de Recuperação de Senha
   */
  async sendPasswordResetEmail(toEmail: string, userName: string, activationCode: string, rawToken: string) {
    const safeName = this.escapeHtml(userName);
    const subject = 'Recuperação de Senha - Sistema Coopera';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 550px; margin: auto; padding: 25px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #285A71;">Redefinição de Senha</h2>
        <p>Olá, ${safeName}. Foi solicitada a redefinição da sua senha no <strong>Coopera</strong>.</p>
        <p>Informe os dados abaixo na tela de redefinição do aplicativo:</p>

        <div style="background-color: #f3f6f8; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 6px 0;"><strong>Código de Confirmação:</strong> <span style="font-size: 18px; color: #285A71; font-weight: bold;">${activationCode}</span></p>
          <p style="margin: 6px 0;"><strong>Token de Redefinição:</strong> <span style="font-size: 18px; color: #285A71; font-weight: bold;">${rawToken}</span></p>
        </div>

        <p style="color: #777; font-size: 12px;">Se não foi você que solicitou, pode desconsiderar esta mensagem com segurança.</p>
      </div>
    `;

    return this.sendEmail(toEmail, userName, subject, html);
  }
}