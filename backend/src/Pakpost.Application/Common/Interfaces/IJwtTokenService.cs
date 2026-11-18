using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IJwtTokenService { (string token, int expiresInSeconds) CreateToken(User user);
}
