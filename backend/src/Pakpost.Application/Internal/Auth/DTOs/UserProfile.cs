
namespace Pakpost.Application.Internal.Auth.DTOs;

public sealed record UserProfile(Guid Id, string Email, string DisplayName,
    string? AvatarUrl = null, bool IsSuperAdmin = false);
