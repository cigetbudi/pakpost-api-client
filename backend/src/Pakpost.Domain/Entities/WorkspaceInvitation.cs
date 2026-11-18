using System.Text.Json;
using Pakpost.Domain.Enums;

namespace Pakpost.Domain.Entities;

public sealed class WorkspaceInvitation
{
    private WorkspaceInvitation()
    {
    }

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid InvitedByUserId { get; private set; }
    public string Email { get; private set; } = "";
    public string RolesJson { get; private set; } = "[]";
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset SentAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? AcceptedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public int Version { get; private set; } = 1;

    public IReadOnlyList<WorkspaceAccessRole> Roles =>
        JsonSerializer.Deserialize<List<WorkspaceAccessRole>>(RolesJson) ?? [];

    public WorkspaceInvitation(
        Guid workspaceId,
        Guid actorId,
        string email,
        IEnumerable<WorkspaceAccessRole> roles,
        string tokenHash,
        DateTimeOffset now)
    {
        Id = Guid.NewGuid();
        WorkspaceId = workspaceId;
        InvitedByUserId = actorId;
        Email = email.Trim().ToLowerInvariant();
        RolesJson = JsonSerializer.Serialize(roles.Distinct().ToArray());
        TokenHash = tokenHash;
        CreatedAt = SentAt = now;
        ExpiresAt = now.AddDays(7);
    }

    public bool IsPending(DateTimeOffset now) =>
        AcceptedAt is null && RevokedAt is null && ExpiresAt > now;

    public void Revoke(DateTimeOffset now)
    {
        if (!IsPending(now))
        {
            throw new InvalidOperationException("Invitation is no longer pending");
        }

        RevokedAt = now;
        Version++;
    }

    public void Resend(string tokenHash, DateTimeOffset now)
    {
        if (!IsPending(now))
        {
            throw new InvalidOperationException("Invitation is no longer pending");
        }

        TokenHash = tokenHash;
        SentAt = now;
        ExpiresAt = now.AddDays(7);
        Version++;
    }

    public void Accept(DateTimeOffset now)
    {
        if (!IsPending(now))
        {
            throw new InvalidOperationException("Invitation is no longer pending");
        }

        AcceptedAt = now;
        Version++;
    }
}
