import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_admin_reminder(days_left: int):
    sender_email = "aadithyabanda@gmail.com"
    receiver_email = "aadithyabanda@gmail.com"
    app_password = "zkihpqnffghuultj"

    msg = MIMEMultipart()
    msg['From'] = "'Dropex.AI Admin' <aadithyabanda@gmail.com>"
    msg['To'] = "Sales Management Team <aadithyabanda@gmail.com>"
    msg['Subject'] = "URGENT: Monthly Sales CSV Upload Required"

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #0c0512; color: #e2e8f0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1a1025; padding: 30px; border-radius: 8px; border: 1px solid #ef4444;">
                <h2 style="color: #ef4444; margin-bottom: 20px; font-weight: bold; letter-spacing: 2px;">SYSTEM OVERRIDE // ADMIN DIRECTIVE</h2>
                <div style="padding: 15px; background-color: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0;"><strong>FROM:</strong> Dropex.AI Administration</p>
                    <p style="margin: 0;"><strong>TO:</strong> Sales Management Team</p>
                </div>
                
                <h3 style="color: #fff;">ACTION REQUIRED IMMEDIATELY</h3>
                <p style="font-size: 16px; line-height: 1.6;">
                    You have exactly <strong><span style="color: #ef4444; font-size: 18px;">{days_left} DAYS LEFT</span></strong> remaining in the month.
                </p>
                
                <p style="font-size: 16px; line-height: 1.6; font-style: italic;">
                    "Please make sure to bulk upload the final Sales CSV file before the end of the month so we can perform the ML Retrain gracefully. Missing this deadline will severely damage next month's inventory forecasts."
                </p>
                
                <div style="margin-top: 30px; border-top: 1px solid #333; padding-top: 20px;">
                    <p style="font-size: 12px; color: #888;">This is an automated administrative email from the Dropex Smart Inventory AI System.</p>
                </div>
            </div>
        </body>
    </html>
    """
    
    msg.attach(MIMEText(html_content, 'html'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, app_password)
        server.send_message(msg)
        server.quit()
        return True, "Email sent successfully"
    except Exception as e:
        return False, str(e)
