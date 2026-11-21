using System.Net.Mail;
using System.Net.Mime;
using Pakpost.Infrastructure.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.UnitTests;

public sealed class PlatformCreatorInvitationEmailMessageTests
{
    [Fact]
    public void CreatesBlueprintCourierCreatorInvitationWithGoogleInstructions()
    {
        using var message = PlatformCreatorInvitationEmailMessage.Create(
            "PakPost <noreply@example.test>", "new.user@example.test",
            "https://pakpost.example.test/?creatorInvite=abc123");

        Assert.False(message.IsBodyHtml);
        Assert.Contains("Google", message.Body);
        Assert.Contains("7 days", message.Body);
        Assert.Contains("?creatorInvite=abc123", message.Body);
        Assert.Single(message.AlternateViews);
        var htmlView = message.AlternateViews[0];
        Assert.Equal(MediaTypeNames.Text.Html, htmlView.ContentType.MediaType);
        htmlView.ContentStream.Position = 0;
        using var reader = new StreamReader(htmlView.ContentStream,
            System.Text.Encoding.UTF8, leaveOpen: true);
        var html = reader.ReadToEnd();
        Assert.Contains("Courier New", html);
        Assert.Contains("Workspace Creator", html);
        Assert.Contains("new.user@example.test", html);
        Assert.Contains("Activate access", html);
        Assert.Contains("href=\"https://pakpost.example.test/?creatorInvite=abc123\"", html);
        Assert.Single(htmlView.LinkedResources);
        Assert.Equal("pakpost-logo", htmlView.LinkedResources[0].ContentId);
        Assert.Contains("src=\"cid:pakpost-logo\"", html);
    }

    [Fact]
    public void EncodesInvitationUrlBeforeRenderingHtml()
    {
        using var message = PlatformCreatorInvitationEmailMessage.Create(
            "noreply@example.test", "person@example.test",
            "https://pakpost.example.test/?creatorInvite=abc&ref=mail");
        var stream = message.AlternateViews[0].ContentStream;
        stream.Position = 0;
        using var reader = new StreamReader(stream, System.Text.Encoding.UTF8, leaveOpen: true);
        Assert.Contains("?creatorInvite=abc&amp;ref=mail", reader.ReadToEnd());
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("http://example.test/?creatorInvite=abc")]
    [InlineData("https://u:p@example.test/?creatorInvite=abc")]
    public void RejectsUntrustedLinks(string link)
    {
        Assert.Throws<ArgumentException>(() => PlatformCreatorInvitationEmailMessage.Create(
            "noreply@example.test", "person@example.test", link));
    }

    [Fact]
    public void PlatformInvitationsCannotBeResentAfterRevokeOrExpiry()
    {
        var now = DateTimeOffset.UtcNow;
        var invite = new PlatformCreatorInvitation(Guid.NewGuid(), "NEW@EXAMPLE.TEST", new string('a', 64), now);
        Assert.Equal("new@example.test", invite.Email);
        Assert.True(invite.IsPending(now));
        Assert.False(invite.IsPending(now.AddDays(8)));
        invite.Revoke(now.AddMinutes(1));
        Assert.False(invite.IsPending(now.AddMinutes(2)));
        Assert.Throws<InvalidOperationException>(() => invite.Resend(new string('b', 64), now.AddMinutes(2)));
    }
}
