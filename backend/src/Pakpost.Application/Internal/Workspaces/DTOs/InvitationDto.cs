using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.DTOs;

public sealed record InvitationDto(Guid Id, string Email, IReadOnlyList<WorkspaceAccessRole> Roles,
    DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, DateTimeOffset? AcceptedAt, DateTimeOffset? RevokedAt);
