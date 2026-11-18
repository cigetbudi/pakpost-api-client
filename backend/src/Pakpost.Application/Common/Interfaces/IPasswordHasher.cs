using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string storedHash);
}
