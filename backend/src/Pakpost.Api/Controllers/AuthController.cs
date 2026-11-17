using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pakpost.Api.Extensions;
using Pakpost.Application.Internal.Auth;
namespace Pakpost.Api.Controllers;
public sealed record GoogleLinkRequest(string Credential, string Password);
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
    [HttpPost("google"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<LoginResult>> Google(GoogleLoginCommand request, CancellationToken ct)
        => Ok(await sender.Send(request, ct));

    [Authorize, HttpPost("google/link"), EnableRateLimiting("auth")]
    public async Task<ActionResult<GoogleLinkResult>> LinkGoogle(GoogleLinkRequest request, CancellationToken ct)
        => Ok(await sender.Send(new GoogleLinkCommand(User.GetUserId(), request.Credential, request.Password), ct));

    [Authorize, HttpGet("google/status")]
    public async Task<ActionResult<GoogleConnectionStatus>> GoogleStatus(CancellationToken ct)
        =>Ok(await sender.Send(new GoogleConnectionStatusQuery(User.GetUserId()),ct));

    [Authorize, HttpGet("me")]
    public async Task<ActionResult<UserProfile>> Me(CancellationToken ct)
        => Ok(await sender.Send(new GetMeQuery(User.GetUserId()),ct));
}
