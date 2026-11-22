using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Pakpost.Api.Security;

/// <summary>
/// Cryptographic token, recipient address and redirect validation for creator
/// invites. Keep links HTTPS-only outside local development.
/// </summary>
internal static class PlatformCreatorInvitationTokens
{
    internal static string? NormalizeEmail(string? raw)
    {
        var email = raw?.Trim();
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 ||
            email.Contains('\r') || email.Contains('\n') ||
            !MailAddress.TryCreate(email, out var parsed) ||
            !string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase)) return null;
        return email.ToLowerInvariant();
    }

    internal static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    internal static string BuildLink(string token, IConfiguration configuration)
    {
        var baseUrl = configuration["Invitations:FrontendBaseUrl"];
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var url) ||
            (url.Scheme != Uri.UriSchemeHttps && !(url.Scheme == Uri.UriSchemeHttp && url.IsLoopback)) ||
            !string.IsNullOrEmpty(url.UserInfo) ||
            !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
            throw new InvalidOperationException("Configure Invitations:FrontendBaseUrl to the PakPost HTTPS frontend URL");
        return new Uri(url, $"?creatorInvite={Uri.EscapeDataString(token)}").ToString();
    }
}
