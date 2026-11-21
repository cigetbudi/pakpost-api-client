using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Infrastructure.Services;
public sealed class GoogleIdentityVerifier(IConfiguration configuration) : IGoogleIdentityVerifier
{
    public async Task<GoogleIdentity> VerifyAsync(string idToken, CancellationToken ct)
    {
        var clientId = configuration["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
            throw AppException.BadRequest("Google sign-in is not enabled");
        if (string.IsNullOrWhiteSpace(idToken) || idToken.Length > 8192)
            throw AppException.Unauthorized("Invalid Google credential");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            // Google.Apis.Auth validates signature against rotated Google keys,
            // trusted audience, issuer, expiry, and token format.
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } });
        }
        catch (InvalidJwtException)
        {
            throw AppException.Unauthorized("Invalid Google credential");
        }
        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Subject) ||
            string.IsNullOrWhiteSpace(payload.Email))
            throw AppException.Unauthorized("Verified Google account required");

        var email = payload.Email.Trim().ToLowerInvariant();
        if (email.Length > 255)
            throw AppException.Unauthorized("Invalid Google account email");
        var name = string.IsNullOrWhiteSpace(payload.Name) ? email.Split('@')[0] : payload.Name.Trim();
        if (name.Length > 120) name = name[..120];
        // Only accept a well-formed Google-hosted picture URL. Never allow
        // arbitrary ID-token picture hosts to become browser image sources.
        string? picture = null;
        if (payload.Picture is { Length: > 0 and <= 2048 } raw &&
            Uri.TryCreate(raw, UriKind.Absolute, out var url) &&
            url.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(url.UserInfo) &&
            (url.Host.Equals("googleusercontent.com", StringComparison.OrdinalIgnoreCase) ||
             url.Host.EndsWith(".googleusercontent.com", StringComparison.OrdinalIgnoreCase)))
            picture = raw;
        return new GoogleIdentity(payload.Subject, email, name, picture);
    }
}
