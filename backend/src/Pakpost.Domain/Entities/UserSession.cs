namespace Pakpost.Domain.Entities;

// Only hashes of the browser's opaque cookie and its CSRF proof are persisted.
public sealed class UserSession
{
    private UserSession() { }
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = "";
    public string CsrfHash { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public string UserAgent { get; private set; } = "";
    public string? AvatarUrl { get; private set; }

    public UserSession(Guid userId, string tokenHash, string csrfHash, DateTimeOffset createdAt, DateTimeOffset expiresAt, string userAgent = "", string? avatarUrl = null)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        TokenHash = tokenHash;
        CsrfHash = csrfHash;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        UserAgent = userAgent;
        AvatarUrl = avatarUrl;
    }

    public void Revoke(DateTimeOffset at) => RevokedAt ??= at;
}
