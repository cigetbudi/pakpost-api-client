namespace Pakpost.Domain.Entities;

/// <summary>One-time, instance-scoped invitation. Never grants workspace membership.</summary>
public sealed class PlatformCreatorInvitation
{
    private PlatformCreatorInvitation() { }

    public Guid Id { get; private set; }
    public Guid InvitedByUserId { get; private set; }
    public string Email { get; private set; } = "";
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset SentAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? AcceptedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public int Version { get; private set; } = 1;

    public PlatformCreatorInvitation(Guid invitedByUserId, string email, string tokenHash, DateTimeOffset now)
    {
        if (invitedByUserId == Guid.Empty || string.IsNullOrWhiteSpace(email) || tokenHash.Length != 64)
            throw new ArgumentException("Invalid creator invitation");
        Id = Guid.NewGuid();
        InvitedByUserId = invitedByUserId;
        Email = email.Trim().ToLowerInvariant();
        TokenHash = tokenHash;
        CreatedAt = SentAt = now;
        ExpiresAt = now.AddDays(7);
    }

    public bool IsPending(DateTimeOffset now) =>
        AcceptedAt is null && RevokedAt is null && ExpiresAt > now;

    public void Resend(string tokenHash, DateTimeOffset now)
    {
        if (!IsPending(now) || tokenHash.Length != 64)
            throw new InvalidOperationException("Invitation is no longer pending");
        TokenHash = tokenHash;
        SentAt = now;
        ExpiresAt = now.AddDays(7);
        Version++;
    }

    public void Revoke(DateTimeOffset now)
    {
        if (!IsPending(now)) throw new InvalidOperationException("Invitation is no longer pending");
        RevokedAt = now;
        Version++;
    }
}
