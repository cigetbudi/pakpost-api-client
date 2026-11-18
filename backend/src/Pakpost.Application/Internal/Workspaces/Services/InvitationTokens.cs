using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

internal static class InvitationTokens
{
    public static string Generate() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
    .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    public static InvitationDto ToDto(WorkspaceInvitation x) => new(x.Id, x.Email, x.Roles, x.CreatedAt, x.ExpiresAt, x.AcceptedAt, x.RevokedAt);
    public static string Link(IConfiguration configuration, string token)
    {
        var root = configuration["Invitations:FrontendBaseUrl"];
        if (!Uri.TryCreate(root, UriKind.Absolute, out var url) ||
            (url.Scheme != Uri.UriSchemeHttps && !(url.Scheme == Uri.UriSchemeHttp && url.IsLoopback)) ||
            !string.IsNullOrEmpty(url.UserInfo) || !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
        throw AppException.BadRequest("Set Invitations__FrontendBaseUrl to the trusted PakPost frontend URL (HTTPS outside localhost)");
        return new Uri(url, $"?invite={Uri.EscapeDataString(token)}").ToString();
    }
}
