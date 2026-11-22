using System.Net.Mime;
using Pakpost.Infrastructure.Services;
using System.Net.Mail;

namespace Pakpost.UnitTests;

public sealed class WorkspaceInvitationEmailMessageTests
{
    [Fact]
    public void CreatesBlueprintCourierEmailWithEmbeddedLogoAndPlainTextFallback()
    {
        using var message = WorkspaceInvitationEmailMessage.Create(
            "PakPost <noreply@example.test>",
            "developer@example.test",
            "Banking API",
            "https://pakpost.example.test/?invite=abc123");

        Assert.False(message.IsBodyHtml);
        Assert.Contains("Banking API", message.Body);
        Assert.Contains("https://pakpost.example.test/?invite=abc123", message.Body);
        Assert.Contains("7 days", message.Body);
        Assert.Single(message.AlternateViews);

        var htmlView = message.AlternateViews[0];
        Assert.Equal(MediaTypeNames.Text.Html, htmlView.ContentType.MediaType);
        var html = ViewText(htmlView);
        Assert.Contains("Courier New", html);
        Assert.Contains("You've been invited.", html);
        Assert.Contains("Banking API", html);
        Assert.Contains("developer@example.test", html);
        Assert.Contains("Accept invitation", html);
        Assert.Contains("href=\"https://pakpost.example.test/?invite=abc123\"", html);
        Assert.DoesNotContain("{{WORKSPACE_NAME}}", html);
        Assert.DoesNotContain("{{INVITATION_URL}}", html);
        Assert.Single(htmlView.LinkedResources);
        Assert.Equal("pakpost-logo", htmlView.LinkedResources[0].ContentId);
        Assert.Equal(MediaTypeNames.Image.Png, htmlView.LinkedResources[0].ContentType.MediaType);
        Assert.Contains("src=\"cid:pakpost-logo\"", html);

        using var logoStream = htmlView.LinkedResources[0].ContentStream;
        var signature = new byte[8];
        Assert.Equal(8, logoStream.Read(signature, 0, signature.Length));
        Assert.Equal(new byte[] {137,80,78,71,13,10,26,10}, signature);
    }

    [Fact]
    public void EscapesDynamicValuesWithoutReinterpretingPlaceholders()
    {
        const string workspaceName = "Dev <Team> & \"QA\" {{INVITATION_URL}}";
        const string invitationUrl = "https://pakpost.example.test/?invite=abc&source=email";
        using var message = WorkspaceInvitationEmailMessage.Create(
            "noreply@example.test", "qa+1@example.test", workspaceName, invitationUrl);

        var html = ViewText(message.AlternateViews[0]);
        Assert.Contains("Dev &lt;Team&gt; &amp; &quot;QA&quot; {{INVITATION_URL}}", html);
        Assert.DoesNotContain("Dev <Team>", html);
        Assert.Contains("?invite=abc&amp;source=email", html);
        Assert.DoesNotContain("?invite=abc&source=email", html);
        Assert.Contains(workspaceName, message.Body);
        Assert.Contains(invitationUrl, message.Body);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("http://evil.example.test/?invite=abc")]
    [InlineData("https://user:password@evil.example.test/?invite=abc")]
    public void RefusesUnsafeInvitationLinks(string invitationUrl)
    {
        Assert.Throws<ArgumentException>(() => WorkspaceInvitationEmailMessage.Create(
            "noreply@example.test", "person@example.test", "Workspace", invitationUrl));
    }

    private static string ViewText(AlternateView view)
    {
        view.ContentStream.Position = 0;
        using var reader = new StreamReader(view.ContentStream, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        return reader.ReadToEnd();
    }
}
