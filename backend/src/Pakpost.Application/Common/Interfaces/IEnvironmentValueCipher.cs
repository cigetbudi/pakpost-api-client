using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IEnvironmentValueCipher
{
    string Protect(string clear);
    string Unprotect(string value);
}
