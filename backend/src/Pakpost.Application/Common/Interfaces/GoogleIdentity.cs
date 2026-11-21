using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public sealed record GoogleIdentity(string Subject, string Email, string DisplayName, string? AvatarUrl = null);
