namespace Pakpost.Domain.Entities;

/// <summary>External account identity; the Google subject (not email) is the stable key.</summary>
public sealed class UserExternalIdentity
{
    private UserExternalIdentity() { } // EF Core
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Provider { get; private set; } = "";
    public string Subject { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }

    public UserExternalIdentity(Guid userId, string provider, string subject)
    {
        if (userId == Guid.Empty || string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(subject))
            throw new ArgumentException("External identity must have a user, provider and subject");
        Id = Guid.NewGuid();
        UserId = userId;
        Provider = provider;
        Subject = subject;
        CreatedAt = DateTimeOffset.UtcNow;
    }
}
