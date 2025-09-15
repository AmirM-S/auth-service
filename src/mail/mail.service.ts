import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const apiUrl = this.configService.get('API_URL');
    const verificationUrl = `${apiUrl}/api/v1/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: this.configService.get('SMTP_USER'),
      to: email,
      subject: 'تایید ایمیل',
      html: `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: right;">
            <h2>به سرویس احراز هویت خوش آمدید!</h2>
            <p>لطفاً برای تایید ایمیل خود روی دکمه زیر کلیک کنید:</p>
            <a href="${verificationUrl}" 
            style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            تایید ایمیل
            </a>
            <p>یا این لینک را در مرورگر خود کپی و باز کنید:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>این لینک ظرف ۲۴ ساعت منقضی خواهد شد.</p>
            <p>اگر شما درخواست تایید ایمیل نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
        </div>
       `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: this.configService.get('SMTP_USER'),
      to: email,
      subject: 'بازنشانی رمز عبور',
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: right;">
      <h2>درخواست بازنشانی رمز عبور</h2>
      <p>شما درخواست بازنشانی رمز عبور کرده‌اید. برای ادامه روی دکمه زیر کلیک کنید:</p>
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">
        بازنشانی رمز عبور
      </a>
      <p>یا این لینک را در مرورگر خود کپی و باز کنید:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>این لینک ظرف ۱ ساعت منقضی خواهد شد.</p>
      <p>اگر شما درخواست بازنشانی نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
    </div>
  `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3001',
    );

    const mailOptions = {
      from: this.configService.get('SMTP_USER'),
      to: email,
      subject: 'خوش آمدید به سرویس احراز هویت',
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: right;">
      <h2>خوش آمدید ${firstName}!</h2>
      <p>حساب کاربری شما با موفقیت ایجاد و تایید شد.</p>
      <p>اکنون می‌توانید وارد حساب کاربری خود شوید:</p>
      <a href="${frontendUrl}/login" 
         style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
        ورود به حساب کاربری
      </a>
      <p>از اینکه به جمع ما پیوستید، متشکریم!</p>
    </div>
  `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
    }
  }
}
