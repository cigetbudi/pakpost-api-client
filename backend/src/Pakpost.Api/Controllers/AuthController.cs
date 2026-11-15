using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Auth;
namespace Pakpost.Api.Controllers;
[ApiController]
[Route("api/auth")]
public sealed class AuthController(ISender sender) : ControllerBase
{
    [HttpPost("register"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<LoginResult>> Register(RegisterCommand request,CancellationToken ct)
        => Ok(await sender.Send(request,ct));
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<LoginResult>> Login(LoginCommand request,CancellationToken ct)
        => Ok(await sender.Send(request,ct));
    [Authorize, HttpGet("me")]
    public async Task<ActionResult<UserProfile>> Me(CancellationToken ct)
        => Ok(await sender.Send(new GetMeQuery(User.GetUserId()),ct));
}
