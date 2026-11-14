using System.Security.Claims;
using Pakpost.Application.Common.Exceptions;
namespace Pakpost.Api.Extensions;
public static class UserClaimsExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue("sub");
        return Guid.TryParse(subject, out var userId)
            ? userId : throw AppException.Unauthorized("Invalid token subject");
    }
}
