import {Module, Global} from '@nestjs/common';
import { MailService } from './mail.services';

/* Global decorator para que o módulo seja acessível em toda a aplicação sem precisar ficar importando indivídualmente em cada
 módulo que precise do serviço de envio de e-mails.
*/
@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}