using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth.DTOs;

public sealed record LoginResult(string AccessToken, int ExpiresInSeconds, UserProfile User);
