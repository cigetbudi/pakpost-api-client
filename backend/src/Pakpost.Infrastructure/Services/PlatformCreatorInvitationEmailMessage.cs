using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using System.Text.RegularExpressions;

namespace Pakpost.Infrastructure.Services;

/// <summary>Blueprint Courier, CID-logo HTML with a text-only alternative.</summary>
public static class PlatformCreatorInvitationEmailMessage
{
    private const string TemplateName = "Pakpost.Infrastructure.Services.EmailTemplates.PlatformCreatorInvitation.html";
    private const string LogoName = "Pakpost.Infrastructure.Services.EmailTemplates.pakpost-logo.png";
    private static readonly Lazy<string> Template = new(() =>
    {
        using var stream = Open(TemplateName);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    });
    private static readonly Regex Placeholder = new(
        @"\{\{(?:RECIPIENT_EMAIL|INVITATION_URL)\}\}",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static MailMessage Create(string sender, string recipient, string invitationUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sender);
        ArgumentException.ThrowIfNullOrWhiteSpace(recipient);
        if (!Uri.TryCreate(invitationUrl, UriKind.Absolute, out var url) ||
            (url.Scheme != Uri.UriSchemeHttps && !(url.Scheme == Uri.UriSchemeHttp && url.IsLoopback)) ||
            !string.IsNullOrEmpty(url.UserInfo))
            throw new ArgumentException("Invitation URL requires HTTPS (or localhost)", nameof(invitationUrl));

        var message = new MailMessage(new MailAddress(sender), new MailAddress(recipient))
        {
            Subject = "PakPost / Workspace Creator invitation",
            SubjectEncoding = Encoding.UTF8,
            Body = $"An administrator invited you to create workspaces on PakPost.\n\n" +
                   $"Use your Google account ({recipient}) to activate the permission.\n" +
                   $"One-time link (expires in 7 days):\n{invitationUrl}\n\n" +
                   "If you did not expect this invitation, ignore this email.\n",
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };
        try
        {
            var html = Placeholder.Replace(Template.Value, match => match.Value switch
            {
                "{{RECIPIENT_EMAIL}}" => WebUtility.HtmlEncode(recipient),
                "{{INVITATION_URL}}" => WebUtility.HtmlEncode(invitationUrl),
                _ => throw new InvalidOperationException("Unexpected email placeholder")
            });
            var view = AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html);
            message.AlternateViews.Add(view);
            view.LinkedResources.Add(new LinkedResource(Open(LogoName), MediaTypeNames.Image.Png)
            {
                ContentId = "pakpost-logo",
                TransferEncoding = TransferEncoding.Base64
            });
            return message;
        }
        catch
        {
            message.Dispose();
            throw;
        }
    }

    private static Stream Open(string name) =>
        typeof(PlatformCreatorInvitationEmailMessage).Assembly.GetManifestResourceStream(name)
        ?? throw new InvalidOperationException($"Missing embedded email resource: {name}");
}
