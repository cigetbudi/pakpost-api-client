namespace Pakpost.Domain.Entities;
public sealed class User
{
    private User() { }
    public Guid Id { get; private set; }
    public string Email { get; private set; } = "";
    public string DisplayName { get; private set; } = "";
    public string PasswordHash { get; private set; } = "";
    public bool IsSuperAdmin { get; private set; }
    public bool IsDisabled { get; private set; } // No public bootstrap of admin privileges
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public void SetDisabled(bool disabled) { IsDisabled = disabled; UpdatedAt = DateTimeOffset.UtcNow; }
    public User(string email, string displayName, string passwordHash)
    {
        Id = Guid.NewGuid(); Email = email.Trim().ToLowerInvariant();
        DisplayName = displayName.Trim(); PasswordHash = passwordHash;
        CreatedAt = UpdatedAt = DateTimeOffset.UtcNow;
    }
}
