using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Workspaces.Services;

internal static class InvitationTokens
{
    public static string Generate() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public static InvitationDto ToDto(WorkspaceInvitation invitation) =>
        new(
            invitation.Id,
            invitation.Email,
            invitation.Roles,
            invitation.CreatedAt,
            invitation.ExpiresAt,
            invitation.AcceptedAt,
            invitation.RevokedAt);

    public static string Link(IConfiguration configuration, string token)
    {
        var root = configuration["Invitations:FrontendBaseUrl"];

        if (!Uri.TryCreate(root, UriKind.Absolute, out var url) ||
            (url.Scheme != Uri.UriSchemeHttps && !(url.Scheme == Uri.UriSchemeHttp && url.IsLoopback)) ||
            !string.IsNullOrEmpty(url.UserInfo) ||
            !string.IsNullOrEmpty(url.Query) ||
            !string.IsNullOrEmpty(url.Fragment))
        {
            throw AppException.BadRequest(
                "Set Invitations__FrontendBaseUrl to the trusted PakPost frontend URL (HTTPS outside localhost)");
        }

        return new Uri(url, $"?invite={Uri.EscapeDataString(token)}").ToString();
    }
}
